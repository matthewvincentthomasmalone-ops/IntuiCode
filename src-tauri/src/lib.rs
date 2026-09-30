//! IntuiCode desktop: the web app plus what a browser can't do.
//!
//! - read and write real project folders
//! - run programs (Python, shell commands) with live output and typed input
//! - find the Python, C++ compiler (g++, clang++ or Visual Studio's cl) and
//!   arduino-cli installed on this computer, and compile C++ with it
//! - serve the website preview from its own address

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

/* ------------------------------------------------------------------ */
/* What the window may use                                             */
/* ------------------------------------------------------------------ */

/// Folders the window may read, write and run things in: ones the person picked in the app's
/// own folder dialog (so a page can't make one up), and IntuiCode's folder for unsaved projects.
/// Programs it may start: the Python and arduino-cli found on this computer, and programs built
/// inside those folders. (Shell commands typed after `$` run in an allowed folder.)
#[derive(Default)]
struct Access {
    folders: Mutex<Vec<PathBuf>>,
    programs: Mutex<Vec<String>>,
}

fn outside(path: &str) -> String {
    format!("{path} is outside the project's folder. Open or save the project there first.")
}

impl Access {
    fn allow_folder(&self, dir: &Path) {
        if let Ok(dir) = dir.canonicalize() {
            let mut folders = self.folders.lock().unwrap();
            if !folders.contains(&dir) {
                folders.push(dir);
            }
        }
    }

    fn allow_program(&self, program: &str) {
        let mut programs = self.programs.lock().unwrap();
        if !programs.iter().any(|p| p == program) {
            programs.push(program.to_string());
        }
    }

    /// The path, if it is inside an allowed folder. The part of it that exists is checked where it
    /// really is, so `..` and links can't lead outside.
    fn path(&self, path: &str) -> Result<PathBuf, String> {
        let p = PathBuf::from(path);
        if !p.is_absolute() || p.components().any(|c| c == Component::ParentDir) {
            return Err(outside(path));
        }
        let mut existing = p.as_path();
        while !existing.exists() {
            existing = existing.parent().ok_or_else(|| outside(path))?;
        }
        let real = existing.canonicalize().map_err(|_| outside(path))?;
        if self.folders.lock().unwrap().iter().any(|dir| real.starts_with(dir)) {
            Ok(p)
        } else {
            Err(outside(path))
        }
    }

    fn program(&self, program: &str) -> Result<(), String> {
        let found = self.programs.lock().unwrap().iter().any(|p| p == program);
        if found || (Path::new(program).is_absolute() && self.path(program).is_ok()) {
            Ok(())
        } else {
            Err(format!("IntuiCode only starts Python, arduino-cli and programs it built, not {program}."))
        }
    }
}

/// Ask for a folder with the app's own dialog; the window may then use it.
#[tauri::command]
async fn pick_folder(app: AppHandle, title: String) -> Option<String> {
    let folder = app.dialog().file().set_title(title).blocking_pick_folder()?.into_path().ok()?;
    app.state::<Access>().allow_folder(&folder);
    Some(folder.to_string_lossy().to_string())
}

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
        // links are skipped: they could lead outside the folder, or round in a circle
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_dir() {
            if !SKIP_DIRS.contains(&name.as_str()) && !name.ends_with(".egg-info") && !name.starts_with('.') {
                walk(&path, &rel_name, out);
            }
            continue;
        }
        if !kind.is_file() {
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
fn read_folder(access: State<Access>, path: String) -> Result<Vec<FileEntry>, String> {
    let root = access.path(&path)?;
    if !root.is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    let top = root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| "project".into());
    let mut out = Vec::new();
    walk(&root, &top, &mut out);
    Ok(out)
}

#[tauri::command]
fn read_text(access: State<Access>, path: String) -> Result<String, String> {
    let p = access.path(&path)?;
    std::fs::read_to_string(&p).map_err(|e| format!("Could not read {path}: {e}"))
}

#[tauri::command]
fn write_text(access: State<Access>, path: String, content: String) -> Result<(), String> {
    let p = access.path(&path)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
    }
    std::fs::write(&p, content).map_err(|e| format!("Could not write {path}: {e}"))
}

/// A folder IntuiCode can use when a project hasn't been saved anywhere yet.
#[tauri::command]
fn scratch_folder(app: AppHandle, access: State<Access>) -> Result<String, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("unsaved-project");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    access.allow_folder(&dir);
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
        let mut pending: Vec<u8> = Vec::new();
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    pending.extend_from_slice(&buf[..n]);
                    // a character split between two reads waits for the rest of it
                    let ready = pending.len() - incomplete_tail(&pending);
                    if ready > 0 {
                        let text = String::from_utf8_lossy(&pending[..ready]).to_string();
                        pending.drain(..ready);
                        let _ = app.emit("proc-output", Output { id, stream, text });
                    }
                }
            }
        }
        if !pending.is_empty() {
            let _ = app.emit("proc-output", Output { id, stream, text: String::from_utf8_lossy(&pending).to_string() });
        }
    });
}

/// How many bytes at the end begin a UTF-8 character that hasn't fully arrived yet.
fn incomplete_tail(bytes: &[u8]) -> usize {
    for back in 1..=bytes.len().min(3) {
        let b = bytes[bytes.len() - back];
        if b & 0xC0 == 0x80 {
            continue; // a continuation byte: the character began earlier
        }
        let len = match b {
            0xF0..=0xF7 => 4,
            0xE0..=0xEF => 3,
            0xC0..=0xDF => 2,
            _ => 1,
        };
        return if len > back { back } else { 0 };
    }
    0
}

fn start(app: AppHandle, procs: &Processes, id: u32, mut cmd: Command) -> Result<(), String> {
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
    cmd.env("PYTHONUNBUFFERED", "1").env("PYTHONIOENCODING", "utf-8");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // no console window
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0); // a group of its own, so Stop also ends what it starts
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
        let procs = app.state::<Processes>();
        procs.stdin.lock().unwrap().remove(&id);
        procs.children.lock().unwrap().remove(&id);
        std::thread::sleep(std::time::Duration::from_millis(80)); // let the last output arrive first
        let _ = app.emit("proc-exit", Exit { id, code });
    });
    Ok(())
}

/// Run a program directly: e.g. python3 -u main.py
#[tauri::command]
fn run_program(app: AppHandle, procs: State<Processes>, access: State<Access>, id: u32, program: String, args: Vec<String>, cwd: String) -> Result<(), String> {
    access.program(&program)?;
    let dir = access.path(&cwd)?;
    let mut cmd = Command::new(&program);
    cmd.args(&args).current_dir(&dir);
    start(app, &procs, id, cmd)
}

/// Run a command line in the system shell, in a folder: e.g. git status
#[tauri::command]
fn run_shell(app: AppHandle, procs: State<Processes>, access: State<Access>, id: u32, command: String, cwd: String) -> Result<(), String> {
    let dir = access.path(&cwd)?;
    #[cfg(windows)]
    let cmd = {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]).current_dir(&dir);
        c
    };
    #[cfg(not(windows))]
    let cmd = {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
        let mut c = Command::new(shell);
        c.args(["-lc", &command]).current_dir(&dir);
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
    let child = procs.children.lock().unwrap().remove(&id);
    if let Some(child) = child {
        let mut child = child.lock().unwrap();
        stop_everything_started_by(child.id());
        let _ = child.kill();
    }
    Ok(())
}

/// A shell's commands, or a web server Python started, keep running when only the program
/// itself is stopped (and keep their port), so stop everything it started too.
fn stop_everything_started_by(pid: u32) {
    #[cfg(windows)]
    let _ = quiet(Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"])).output();
    #[cfg(unix)]
    let _ = Command::new("kill").args(["-s", "KILL", "--", &format!("-{pid}")]).output();
}

/// The Python installed on this computer, if any: [program, version].
#[tauri::command]
fn find_python(access: State<Access>) -> Option<(String, String)> {
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
                access.allow_program(program);
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
fn compile_cpp(app: AppHandle, procs: State<Processes>, compiler: State<Compiler>, access: State<Access>, id: u32, source: String, output: String, cwd: String) -> Result<(), String> {
    let dir = access.path(&cwd)?;
    for file in [&source, &output] {
        access.path(&dir.join(file).to_string_lossy())?;
    }
    let tool = compiler.0.lock().unwrap().clone().or_else(|| detect_cpp().map(|(t, _)| t)).ok_or("No C++ compiler was found on this computer.")?;
    let cmd = match tool {
        CppTool::Gnu(program) => {
            let mut c = Command::new(program);
            c.args(["-std=c++20", "-O0", "-o", &output, &source]).current_dir(&dir);
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
fn find_arduino(access: State<Access>) -> Option<(String, String)> {
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
                let program = program.to_string_lossy().to_string();
                access.allow_program(&program);
                return Some((program, first_line(&out.stdout)));
            }
        }
    }
    None
}

/// Run a program to the end and hand back what it printed: [exit code, stdout, stderr].
#[tauri::command]
async fn run_capture(access: State<'_, Access>, program: String, args: Vec<String>, cwd: Option<String>) -> Result<(i32, String, String), String> {
    access.program(&program)?;
    let dir = match cwd {
        Some(dir) => Some(access.path(&dir)?),
        None => None,
    };
    tauri::async_runtime::spawn_blocking(move || -> Result<(i32, String, String), String> {
        let mut cmd = Command::new(&program);
        cmd.args(&args);
        if let Some(dir) = dir {
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
    let out = quiet(Command::new("git").arg("--version")).output().ok()?;
    let mut text = String::new();
    BufReader::new(&out.stdout[..]).read_line(&mut text).ok()?;
    out.status.success().then(|| text.trim().to_string())
}

/* ------------------------------------------------------------------ */
/* The website preview                                                 */
/* ------------------------------------------------------------------ */

/// The page in the preview, served at preview://localhost/page-N.html (http://preview.localhost/…
/// on Windows). Served from there it has no Content-Security-Policy of its own, while the editor's
/// forbids inline scripts. The preview frame is sandboxed without allow-same-origin, so the page
/// runs in an origin of its own: it can't reach the editor or use these commands.
#[derive(Default)]
struct Preview(Mutex<String>);

#[tauri::command]
fn set_preview(preview: State<Preview>, html: String) {
    *preview.0.lock().unwrap() = html;
}

fn preview_page<R: tauri::Runtime>(app: &AppHandle<R>, path: &str) -> tauri::http::Response<Vec<u8>> {
    let page = path.trim_start_matches('/').starts_with("page-");
    let body = if page {
        let html = app.state::<Preview>().0.lock().unwrap().clone();
        html.into_bytes()
    } else {
        Vec::new()
    };
    tauri::http::Response::builder()
        .status(if page { 200 } else { 404 })
        .header("Content-Type", "text/html; charset=utf-8")
        .header("Cache-Control", "no-store")
        .body(body)
        .unwrap()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Processes::default())
        .manage(Compiler::default())
        .manage(Access::default())
        .manage(Preview::default())
        .register_uri_scheme_protocol("preview", |ctx, request| preview_page(ctx.app_handle(), request.uri().path()))
        .invoke_handler(tauri::generate_handler![
            read_folder, read_text, write_text, scratch_folder, pick_folder, set_preview,
            run_program, run_shell, write_stdin, stop_program, find_python, find_git, find_cpp,
            compile_cpp, find_arduino, run_capture
        ])
        .run(tauri::generate_context!())
        .expect("IntuiCode could not start");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_split_character_waits_for_the_rest() {
        let euro = "€".as_bytes();
        let face = "😀".as_bytes();
        assert_eq!(incomplete_tail(b"plain"), 0);
        assert_eq!(incomplete_tail(&euro[..1]), 1);
        assert_eq!(incomplete_tail(&[b'a', euro[0], euro[1]]), 2);
        assert_eq!(incomplete_tail(euro), 0);
        assert_eq!(incomplete_tail(&face[..3]), 3);
        assert_eq!(incomplete_tail(face), 0);
    }

    #[test]
    fn only_allowed_folders_and_programs() {
        let base = std::env::temp_dir().join(format!("intuicode-access-{}", std::process::id()));
        let project = base.join("project");
        let other = base.join("other");
        std::fs::create_dir_all(&project).unwrap();
        std::fs::create_dir_all(&other).unwrap();
        let access = Access::default();
        access.allow_folder(&project);
        let at = |p: &Path| p.to_string_lossy().to_string();
        assert!(access.path(&at(&project.join("main.py"))).is_ok());
        assert!(access.path(&at(&project.join(".intuicode/build/new.txt"))).is_ok());
        assert!(access.path(&at(&other.join("main.py"))).is_err());
        assert!(access.path(&at(&project.join("..").join("other").join("main.py"))).is_err());
        assert!(access.path("main.py").is_err());
        access.allow_program("python3");
        assert!(access.program("python3").is_ok());
        assert!(access.program("sh").is_err());
        assert!(access.program(&at(&project.join("program"))).is_ok());
        assert!(access.program(&at(&other.join("program"))).is_err());
        let _ = std::fs::remove_dir_all(&base);
    }
}
