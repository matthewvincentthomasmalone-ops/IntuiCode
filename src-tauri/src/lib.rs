//! IntuiCode desktop: the web app plus what a browser can't do.
//!
//! - read and write real project folders
//! - run programs (Python, shell commands) with live output and typed input
//! - find the Python installed on this computer

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

/// A C++ compiler on this computer, if any: [program, version line].
#[tauri::command]
fn find_cpp() -> Option<(String, String)> {
    for program in ["g++", "clang++", "c++"] {
        let mut cmd = Command::new(program);
        cmd.arg("--version");
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        if let Ok(out) = cmd.output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout).lines().next().unwrap_or("").trim().to_string();
                return Some((program.to_string(), text));
            }
        }
    }
    None
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
        .invoke_handler(tauri::generate_handler![
            read_folder, read_text, write_text, exists, scratch_folder,
            run_program, run_shell, write_stdin, stop_program, find_python, find_git, find_cpp
        ])
        .run(tauri::generate_context!())
        .expect("IntuiCode could not start");
}
