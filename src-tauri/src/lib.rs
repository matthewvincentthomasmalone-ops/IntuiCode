//! IntuiCode desktop: the web app plus what a browser can't do.
//!
//! - read and write real project folders
//! - run programs (Python, shell commands) with live output and typed input
//! - find the Python, C++ compiler (g++, clang++ or Visual Studio's cl) and
//!   arduino-cli installed on this computer, and compile C++ with it

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

const SKIP_DIRS: &[&str] = &[
    "venv", ".venv", "env", "node_modules", "__pycache__", ".git", "site-packages", "build", "dist",
    ".tox", ".mypy_cache", ".pytest_cache", ".idea", ".vscode", "target", ".next", ".nuxt", "coverage",
];
const CODE_EXT: &[&str] = &[
    "py", "js", "jsx", "mjs", "cjs", "ts", "tsx", "html", "htm", "css", "cpp", "cc", "cxx", "hpp", "hh", "h", "ino",
];
const MAX_FILES: usize = 400;
const MAX_BYTES: u64 = 600_000;

#[derive(Serialize)]
struct FileEntry {
    name: String,
    source: String,
}

fn wanted(name: &str) -> Option<&'static str> {
    let lower = name.to_lowercase();
    if lower == ".env" || lower.starts_with(".env.") {
        return Some("secret");
    }
    if let Some(ext) = Path::new(&lower).extension().and_then(|e| e.to_str()) {
        if CODE_EXT.contains(&ext) {
            return Some("code");
        }
    }
    if lower.starts_with("readme") || (lower.starts_with("requirements") && lower.ends_with(".txt"))
        || lower == "pyproject.toml" || lower == "pipfile" || lower == "package.json"
    {
        return Some("extra");
    }
    None
}

fn walk(dir: &Path, rel: &str, out: &mut Vec<FileEntry>) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    let mut entries: Vec<_> = entries.flatten().collect();
    entries.sort_by_key(|e| e.file_name());
    for entry in entries {
        if out.len() >= MAX_FILES {
            return;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path();
        let rel_name = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        if path.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) && !name.ends_with(".egg-info") && !name.starts_with('.') {
                walk(&path, &rel_name, out);
            }
            continue;
        }
        match wanted(&name) {
            Some("secret") => out.push(FileEntry { name: rel_name, source: String::new() }), // never read secrets
            Some(_) => {
                if entry.metadata().map(|m| m.len() <= MAX_BYTES).unwrap_or(false) {
                    if let Ok(text) = std::fs::read_to_string(&path) {
                        out.push(FileEntry { name: rel_name, source: text.replace("\r\n", "\n") });
                    }
                }
            }
            None => {}
        }
    }
}

/// Every readable code file in a folder, named "<folder>/<path>".
#[tauri::command]
fn read_folder(path: String) -> Result<Vec<FileEntry>, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    let top = root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "project".into());
    let mut out = Vec::new();
    walk(&root, &top, &mut out);
    Ok(out)
}

#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Could not read {path}: {e}"))
}

#[tauri::command]
fn write_text(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
    }
    std::fs::write(&p, content).map_err(|e| format!("Could not write {path}: {e}"))
}

#[tauri::command]
fn exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// A folder IntuiCode can use when a project hasn't been saved anywhere yet.
#[tauri::command]
fn scratch_folder(app: AppHandle) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("unsaved-project");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

/* ------------------------------------------------------------------ */
/* Running programs                                                    */
/* ------------------------------------------------------------------ */

#[derive(Default)]
struct Processes {
    stdin: Mutex<HashMap<u32, ChildStdin>>,
    children: Mutex<HashMap<u32, Arc<Mutex<Child>>>>,
}

#[derive(Clone, Serialize)]
struct Output {
    id: u32,
    stream: &'static str,
    text: String,
}

#[derive(Clone, Serialize)]
struct Exit {
    id: u32,
    code: Option<i32>,
}

fn pump<R: Read + Send + 'static>(app: AppHandle, id: u32, stream: &'static str, reader: R) {
    std::thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app.emit("proc-output", Output { id, stream, text });
                }
            }
        }
    });
}

fn start(app: AppHandle, procs: &Processes, id: u32, mut cmd: Command) -> Result<(), String> {
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.env("PYTHONUNBUFFERED", "1").env("PYTHONIOENCODING", "utf-8");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // no console window
    }
    let mut child = cmd.spawn().map_err(|e| format!("Could not start the program: {e}"))?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    if let Some(stdin) = child.stdin.take() {
        procs.stdin.lock().unwrap().insert(id, stdin);
    }
    pump(app.clone(), id, "stdout", stdout);
    pump(app.clone(), id, "stderr", stderr);
    let child = Arc::new(Mutex::new(child));
    procs.children.lock().unwrap().insert(id, child.clone());
    std::thread::spawn(move || {
        let code = loop {
            if let Ok(Some(status)) = child.lock().unwrap().try_wait() {
                break status.code();
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        };
        std::thread::sleep(std::time::Duration::from_millis(80)); // let the last output arrive first
        let _ = app.emit("proc-exit", Exit { id, code });
    });
    Ok(())
}

/// Run a program directly: e.g. python3 -u main.py
#[tauri::command]
fn run_program(app: AppHandle, procs: State<Processes>, id: u32, program: String, args: Vec<String>, cwd: String) -> Result<(), String> {
    let mut cmd = Command::new(&program);
    cmd.args(&args).current_dir(&cwd);
    start(app, &procs, id, cmd)
}

/// Run a command line in the system shell, in a folder: e.g. git status
#[tauri::command]
fn run_shell(app: AppHandle, procs: State<Processes>, id: u32, command: String, cwd: String) -> Result<(), String> {
    #[cfg(windows)]
    let cmd = {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]).current_dir(&cwd);
        c
    };
    #[cfg(not(windows))]
    let cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
        let mut c = Command::new(shell);
        c.args(["-lc", &command]).current_dir(&cwd);
        c
    };
    start(app, &procs, id, cmd)
}

#[tauri::command]
fn write_stdin(procs: State<Processes>, id: u32, text: String) -> Result<(), String> {
    let mut map = procs.stdin.lock().unwrap();
    let stdin = map.get_mut(&id).ok_or("That program has finished.")?;
    stdin.write_all(text.as_bytes()).and_then(|_| stdin.flush()).map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_program(procs: State<Processes>, id: u32) -> Result<(), String> {
    procs.stdin.lock().unwrap().remove(&id);
    if let Some(child) = procs.children.lock().unwrap().remove(&id) {
        let _ = child.lock().unwrap().kill();
    }
    Ok(())
}

/// The Python installed on this computer, if any: [program, version].
#[tauri::command]
fn find_python() -> Option<(String, String)> {
    let candidates: &[&str] = if cfg!(windows) { &["python", "py", "python3"] } else { &["python3", "python"] };
    for program in candidates {
        let mut cmd = Command::new(program);
        cmd.arg("--version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        if let Ok(out) = cmd.output() {
            let text = String::from_utf8_lossy(&out.stdout).to_string() + &String::from_utf8_lossy(&out.stderr);
            if out.status.success() && text.contains("Python 3") {
                return Some((program.to_string(), text.trim().replace("Python ", "")));
            }
        }
    }
    None
}

/* ------------------------------------------------------------------ */
/* C++ compilers: g++ / clang++, or Visual Studio's cl on Windows      */
/* ------------------------------------------------------------------ */

#[derive(Clone, Debug)]
enum CppTool {
    /// g++, clang++ or c++ on the PATH
    Gnu(String),
    /// Visual Studio's cl.exe. `vcvars` sets up its environment; None when cl is already on the PATH
    /// (a "Developer Command Prompt").
    Msvc { vcvars: Option<PathBuf> },
}

#[derive(Default)]
struct Compiler(Mutex<Option<CppTool>>);

fn quiet(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd
}

fn first_line(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).lines().next().unwrap_or("").trim().to_string()
}

/// Visual Studio (or its Build Tools) with the C++ workload: (vcvars batch file, product name).
#[cfg(windows)]
fn find_visual_studio() -> Option<(PathBuf, String)> {
    let arch_bat = if cfg!(target_arch = "aarch64") { "vcvarsarm64.bat" } else { "vcvars64.bat" };
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    let vswhere = PathBuf::from(&pf86).join(r"Microsoft Visual Studio\Installer\vswhere.exe");
    let mut found: Vec<(PathBuf, String)> = Vec::new();
    if vswhere.exists() {
        let ask = |prop: &str| -> Option<String> {
            let out = quiet(Command::new(&vswhere).args(["-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", prop])).output().ok()?;
            let line = first_line(&out.stdout);
            (!line.is_empty()).then_some(line)
        };
        if let Some(dir) = ask("installationPath") {
            let name = ask("displayName").unwrap_or_else(|| "Visual Studio".into());
            found.push((PathBuf::from(dir), name));
        }
    }
    // no vswhere (or no answer): look in the usual places
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    for (root, year) in [(&pf, "2022"), (&pf86, "2022"), (&pf86, "2019"), (&pf, "2019"), (&pf86, "2017")] {
        for edition in ["BuildTools", "Community", "Professional", "Enterprise"] {
            found.push((PathBuf::from(root).join("Microsoft Visual Studio").join(year).join(edition), format!("Visual Studio {year} {edition}")));
        }
    }
    for (dir, name) in found {
        let bat = dir.join(r"VC\Auxiliary\Build").join(arch_bat);
        let bat = if bat.exists() { bat } else { dir.join(r"VC\Auxiliary\Build\vcvars64.bat") };
        if bat.exists() {
            return Some((bat, name));
        }
    }
    None
}

fn detect_cpp() -> Option<(CppTool, String)> {
    #[cfg(windows)]
    {
        // Visual Studio first: it is the usual C++ compiler on Windows
        if let Some((bat, name)) = find_visual_studio() {
            return Some((CppTool::Msvc { vcvars: Some(bat) }, format!("{name} (cl)")));
        }
        if let Ok(out) = quiet(&mut Command::new("cl")).output() {
            let text = String::from_utf8_lossy(&out.stderr).to_string();
            if text.contains("Microsoft") {
                return Some((CppTool::Msvc { vcvars: None }, first_line(text.as_bytes())));
            }
        }
    }
    for program in ["g++", "clang++", "c++"] {
        if let Ok(out) = quiet(Command::new(program).arg("--version")).output() {
            if out.status.success() {
                return Some((CppTool::Gnu(program.to_string()), first_line(&out.stdout)));
            }
        }
    }
    None
}

/// A C++ compiler on this computer, if any: [name, version].
#[tauri::command]
fn find_cpp(compiler: State<Compiler>) -> Option<(String, String)> {
    let found = detect_cpp();
    *compiler.0.lock().unwrap() = found.as_ref().map(|(tool, _)| tool.clone());
    found.map(|(tool, version)| {
        let name = match tool {
            CppTool::Gnu(p) => p,
            CppTool::Msvc { .. } => "msvc".to_string(),
        };
        (name, version)
    })
}

/// Compile one C++ file into a program, with live output (events like run_program).
#[tauri::command]
fn compile_cpp(app: AppHandle, procs: State<Processes>, compiler: State<Compiler>, id: u32, source: String, output: String, cwd: String) -> Result<(), String> {
    let tool = compiler.0.lock().unwrap().clone().or_else(|| detect_cpp().map(|(t, _)| t)).ok_or("No C++ compiler was found on this computer.")?;
    let cmd = match tool {
        CppTool::Gnu(program) => {
            let mut c = Command::new(program);
            c.args(["-std=c++20", "-O0", "-o", &output, &source]).current_dir(&cwd);
            c
        }
        CppTool::Msvc { vcvars } => msvc_command(vcvars, &source, &output, &cwd),
    };
    start(app, &procs, id, cmd)
}

#[cfg(windows)]
fn msvc_command(vcvars: Option<PathBuf>, source: &str, output: &str, cwd: &str) -> Command {
    use std::os::windows::process::CommandExt;
    // object files go next to the program (in .intuicode\build), not among the project's files
    let output = output.replace('/', "\\");
    let fo = Path::new(&output).parent().map(|p| p.to_string_lossy().to_string()).filter(|p| !p.is_empty()).map(|d| format!(" /Fo{d}\\")).unwrap_or_default();
    let cl = format!("cl /nologo /std:c++20 /EHsc /utf-8{fo} /Fe:\"{output}\" \"{source}\"");
    let mut c = Command::new("cmd");
    match vcvars {
        // vcvars sets up the paths cl needs, then cl runs in the same shell
        Some(bat) => c.raw_arg(format!("/S /C \"call \"{}\" >nul && {cl}\"", bat.display())),
        None => c.raw_arg(format!("/S /C \"{cl}\"")),
    };
    c.current_dir(cwd);
    c
}

#[cfg(not(windows))]
fn msvc_command(_vcvars: Option<PathBuf>, _source: &str, _output: &str, cwd: &str) -> Command {
    let mut c = Command::new("cl");
    c.current_dir(cwd);
    c
}

/* ------------------------------------------------------------------ */
/* Arduino boards, through arduino-cli                                 */
/* ------------------------------------------------------------------ */

/// arduino-cli, on the PATH or inside an installed Arduino IDE 2: [program, version].
#[tauri::command]
fn find_arduino() -> Option<(String, String)> {
    let mut candidates: Vec<PathBuf> = vec![PathBuf::from("arduino-cli")];
    #[cfg(windows)]
    for var in ["ProgramFiles", "LOCALAPPDATA"] {
        if let Ok(root) = std::env::var(var) {
            let base = PathBuf::from(root);
            for dir in [base.join("Arduino IDE"), base.join("Programs").join("Arduino IDE")] {
                candidates.push(dir.join(r"resources\app\lib\backend\resources\arduino-cli.exe"));
            }
        }
    }
    #[cfg(target_os = "macos")]
    candidates.push(PathBuf::from("/Applications/Arduino IDE.app/Contents/Resources/app/lib/backend/resources/arduino-cli"));
    for program in candidates {
        if let Ok(out) = quiet(Command::new(&program).arg("version")).output() {
            if out.status.success() {
                return Some((program.to_string_lossy().to_string(), first_line(&out.stdout)));
            }
        }
    }
    None
}

/// Run a program to the end and hand back what it printed: [exit code, stdout, stderr].
#[tauri::command]
async fn run_capture(program: String, args: Vec<String>, cwd: Option<String>) -> Result<(i32, String, String), String> {
    tauri::async_runtime::spawn_blocking(move || -> Result<(i32, String, String), String> {
        let mut cmd = Command::new(&program);
        cmd.args(&args);
        if let Some(dir) = cwd {
            cmd.current_dir(dir);
        }
        let out = quiet(&mut cmd).output().map_err(|e| format!("Could not start {program}: {e}"))?;
        Ok((out.status.code().unwrap_or(-1), String::from_utf8_lossy(&out.stdout).to_string(), String::from_utf8_lossy(&out.stderr).to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The Git installed on this computer, if any.
#[tauri::command]
fn find_git() -> Option<String> {
    let out = Command::new("git").arg("--version").output().ok()?;
    let mut text = String::new();
    BufReader::new(&out.stdout[..]).read_line(&mut text).ok()?;
    out.status.success().then(|| text.trim().to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Processes::default())
        .manage(Compiler::default())
        .invoke_handler(tauri::generate_handler![
            read_folder, read_text, write_text, exists, scratch_folder,
            run_program, run_shell, write_stdin, stop_program, find_python, find_git, find_cpp,
            compile_cpp, find_arduino, run_capture
        ])
        .run(tauri::generate_context!())
        .expect("IntuiCode could not start");
}
