//! IntuaCode desktop: the web app plus what a browser can't do.
//!
//! - read and write real project folders
//! - run programs (Python, shell commands) with live output and typed input
//! - find the Python, C++ compiler (g++, clang++ or Visual Studio's cl) and
//!   arduino-cli installed on this computer, and compile C++ with it
//! - serve the website preview's files at a local address of its own (http://127.0.0.1:<port>)
//! - open files and folders dropped on the window
//! - ask the page before the window closes with changes not saved

use std::collections::{HashMap, HashSet};
#[cfg(target_os = "linux")]
use std::ffi::{OsStr, OsString};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, RunEvent, State, WindowEvent};
use tauri_plugin_dialog::DialogExt;

/* ------------------------------------------------------------------ */
/* What the window may use                                             */
/* ------------------------------------------------------------------ */

/// Folders the window may read, write and run things in: ones the person picked in the app's
/// own folder dialog (so a page can't make one up), and IntuaCode's folder for unsaved projects.
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
            Err(format!("IntuaCode only starts Python, arduino-cli and programs it built, not {program}."))
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
/// The endings of every language a project's files can be in (lang/languages.js), except plain text.
const CODE_EXT: &[&str] = &[
    "py", "pyw", "js", "jsx", "mjs", "cjs", "ts", "mts", "cts", "tsx", "html", "htm", "css", "cpp", "cc", "cxx", "hpp", "hh", "hxx", "h", "ino",
    "vue", "php", "rb", "rake", "gemspec", "erb", "ejs", "c", "rs", "go", "zig", "cs", "csx", "java", "kt", "kts", "swift", "m", "mm",
    "dart", "scala", "sc", "lua", "sh", "bash", "zsh", "ex", "exs", "el", "ml", "mli", "elm", "res", "resi", "sol", "ql", "qll", "tla",
    "rdl", "sql", "json", "yaml", "yml", "toml", "csv", "md", "markdown",
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

/// A file's bytes as base64: the pictures in a project's images/ folder.
#[tauri::command]
fn read_bytes(access: State<Access>, path: String) -> Result<String, String> {
    let p = access.path(&path)?;
    let bytes = std::fs::read(&p).map_err(|e| format!("Could not read {path}: {e}"))?;
    Ok(STANDARD.encode(bytes))
}

#[tauri::command]
fn write_bytes(access: State<Access>, path: String, data: String) -> Result<(), String> {
    let p = access.path(&path)?;
    let bytes = STANDARD.decode(data.as_bytes()).map_err(|e| format!("Could not write {path}: {e}"))?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Could not create {}: {e}", parent.display()))?;
    }
    std::fs::write(&p, bytes).map_err(|e| format!("Could not write {path}: {e}"))
}

/// The names of the files directly in a folder (none if there's no such folder).
#[tauri::command]
fn list_files(access: State<Access>, path: String) -> Result<Vec<String>, String> {
    let p = access.path(&path)?;
    let Ok(entries) = std::fs::read_dir(&p) else { return Ok(Vec::new()) };
    let mut names: Vec<String> = entries
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    names.sort();
    Ok(names)
}

/// A folder IntuaCode can use when a project hasn't been saved anywhere yet.
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
    quiet(&mut cmd);
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
    use_venv(&mut cmd, &dir);
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
        use_venv(&mut c, &dir);
        if let Some(helper) = askpass() {
            c.env("SUDO_ASKPASS", helper);
        }
        c
    };
    start(app, &procs, id, cmd)
}

/// A virtual environment in the project folder (.venv or venv), if there is one. Linux (and
/// Homebrew on a Mac) keeps the system Python's packages for the system, so this is where
/// `pip install` can put a project's packages. (`activate` is made last: a venv that couldn't be
/// finished, as on Ubuntu without python3-venv, has a Python but not that, and isn't one.)
#[cfg(unix)]
fn venv_in(dir: &Path) -> Option<PathBuf> {
    [".venv", "venv"].iter().map(|name| dir.join(name)).find(|venv| {
        venv.join("bin/activate").is_file() && (venv.join("bin/python3").exists() || venv.join("bin/python").exists())
    })
}

/// Programs and commands in a project with a virtual environment use its Python and pip.
#[allow(unused_variables)]
fn use_venv(cmd: &mut Command, dir: &Path) {
    #[cfg(unix)]
    if let Some(venv) = venv_in(dir) {
        let mut path = std::ffi::OsString::from(venv.join("bin"));
        if let Some(old) = std::env::var_os("PATH") {
            path.push(":");
            path.push(old);
        }
        cmd.env("PATH", path).env("VIRTUAL_ENV", &venv).env_remove("PYTHONHOME");
    }
}

/// The name of the project's virtual environment, if it has one (see venv_in).
#[tauri::command]
#[allow(unused_variables)]
fn find_venv(access: State<Access>, cwd: String) -> Option<String> {
    #[cfg(unix)]
    return venv_in(&access.path(&cwd).ok()?).map(|venv| venv.file_name().unwrap_or_default().to_string_lossy().to_string());
    #[cfg(not(unix))]
    None
}

/// Programs that ask for a password in a window. sudo needs a terminal to ask for one, and a
/// command typed after `$` has none, so without one of these `$ sudo apt install g++` can't work.
#[cfg(unix)]
const ASKPASS: &[&str] = &[
    "/usr/bin/ksshaskpass",                     // KDE
    "/usr/bin/ssh-askpass",                     // Debian and Ubuntu (whichever is installed)
    "/usr/lib/ssh/ssh-askpass",                 // Arch
    "/usr/libexec/openssh/gnome-ssh-askpass",   // Fedora
    "/usr/libexec/openssh/ssh-askpass",
    "/usr/lib/openssh/gnome-ssh-askpass",
    "/usr/bin/lxqt-openssh-askpass",
    "/usr/libexec/seahorse/ssh-askpass",
    "/usr/lib/seahorse/ssh-askpass",
];

/// The password window for sudo, unless the person chose one already (SUDO_ASKPASS).
#[cfg(unix)]
fn askpass() -> Option<&'static str> {
    if std::env::var_os("SUDO_ASKPASS").is_some() {
        return None;
    }
    ASKPASS.iter().copied().find(|helper| Path::new(helper).exists())
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
        end(&child);
    }
    Ok(())
}

fn end(child: &Mutex<Child>) {
    let mut child = child.lock().unwrap();
    stop_everything_started_by(child.id());
    let _ = child.kill();
}

/// Ending IntuaCode with a signal (Ctrl+C in the terminal it was started from, `kill`, the terminal
/// closing) ends it the way closing its window does, so the programs it started end too: each
/// runs in a group of its own, which those signals don't reach. A second one ends it at once.
#[cfg(unix)]
fn end_on_signals(app: AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static ASKED: AtomicBool = AtomicBool::new(false);
    extern "C" fn asked(signal: libc::c_int) {
        ASKED.store(true, Ordering::SeqCst);
        unsafe { libc::signal(signal, libc::SIG_DFL) };
    }
    for signal in [libc::SIGTERM, libc::SIGINT, libc::SIGHUP] {
        unsafe { libc::signal(signal, asked as extern "C" fn(libc::c_int) as libc::sighandler_t) };
    }
    std::thread::spawn(move || {
        while !ASKED.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        app.exit(0);
    });
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
        if let Ok(out) = quiet(Command::new(program).arg("--version")).output() {
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
    #[cfg_attr(not(windows), allow(dead_code))]
    Msvc { vcvars: Option<PathBuf> },
}

#[derive(Default)]
struct Compiler(Mutex<Option<CppTool>>);

/// Every program IntuaCode starts goes through here: no console window on Windows, and on Linux
/// none of the settings the AppImage made for IntuaCode's own window.
fn quiet(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    #[cfg(target_os = "linux")]
    if let (Some(_), Some(appdir)) = (std::env::var_os("APPIMAGE"), std::env::var_os("APPDIR")) {
        for (key, value) in outside_appimage(std::env::vars_os(), &appdir) {
            match value {
                Some(value) => cmd.env(key, value),
                None => cmd.env_remove(key),
            };
        }
    }
    cmd
}

/// The AppImage starts IntuaCode with GTK and GLib settings that point inside itself. Other
/// programs given them can't find their own parts (a browser or editor opened with `$`, a
/// Tkinter window, another AppImage), so they get the settings from before the AppImage, as far
/// as that can be told: each setting's parts inside the AppImage are taken out, and a setting with
/// nothing else in it is removed (None).
#[cfg(target_os = "linux")]
fn outside_appimage(vars: impl Iterator<Item = (OsString, OsString)>, appdir: &OsStr) -> Vec<(OsString, Option<OsString>)> {
    // set by the AppImage itself, and GTK_THEME, which its GTK settings replace whatever it was
    const ITS_OWN: &[&str] = &["APPIMAGE", "APPDIR", "ARGV0", "OWD", "GTK_THEME"];
    let appdir = appdir.to_string_lossy();
    let mut out = Vec::new();
    for (key, value) in vars {
        if key.to_str().is_some_and(|k| ITS_OWN.contains(&k)) {
            out.push((key, None));
            continue;
        }
        let Some(text) = value.to_str() else { continue };
        if !text.contains(&*appdir) {
            continue;
        }
        let kept: Vec<&str> = text.split(':').filter(|part| !part.starts_with(&*appdir)).collect();
        out.push((key, (!kept.is_empty()).then(|| kept.join(":").into())));
    }
    out
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
    #[allow(unused_mut)]
    let mut candidates: Vec<PathBuf> = vec![PathBuf::from("arduino-cli")];
    #[cfg(target_os = "linux")]
    candidates.extend(linux_arduino_cli());
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

/// Where arduino-cli is on Linux when it isn't on the PATH: installed for one person (its install
/// script puts it in ~/bin; or ~/.local/bin), the snap, or inside an Arduino IDE 2 unpacked from
/// its .zip (~/arduino-ide_2.3.6_Linux_64bit, /opt/arduino-ide…) or installed from Flathub.
/// (The Arduino IDE's AppImage keeps its arduino-cli inside, out of reach.)
#[cfg(target_os = "linux")]
fn linux_arduino_cli() -> Vec<PathBuf> {
    const IN_THE_IDE: &str = "resources/app/lib/backend/resources/arduino-cli";
    let home = std::env::var_os("HOME").map(PathBuf::from);
    let mut found = Vec::new();
    if let Some(home) = &home {
        found.push(home.join("bin/arduino-cli"));
        found.push(home.join(".local/bin/arduino-cli"));
    }
    found.push(PathBuf::from("/snap/bin/arduino-cli"));
    let unpacked_in = home.iter().flat_map(|h| [h.clone(), h.join("Applications"), h.join("Downloads")]).chain([PathBuf::from("/opt")]);
    for dir in unpacked_in {
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().to_lowercase().starts_with("arduino-ide") {
                found.push(entry.path().join(IN_THE_IDE));
            }
        }
    }
    let flatpaks = home.map(|h| h.join(".local/share/flatpak")).into_iter().chain([PathBuf::from("/var/lib/flatpak")]);
    for root in flatpaks {
        found.extend(find_file(&root.join("app/cc.arduino.IDE2/current/active/files"), "arduino-cli", 7));
    }
    found.retain(|p| p.is_file());
    found
}

/// A file with this name in a folder, or in the folders inside it (going down at most `depth`).
#[cfg(target_os = "linux")]
fn find_file(dir: &Path, name: &str, depth: u32) -> Option<PathBuf> {
    let mut folders = Vec::new();
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let Ok(kind) = entry.file_type() else { continue };
        if kind.is_file() && entry.file_name() == name {
            return Some(entry.path());
        }
        if kind.is_dir() {
            folders.push(entry.path());
        }
    }
    if depth == 0 {
        return None;
    }
    folders.iter().find_map(|f| find_file(f, name, depth - 1))
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

/// The project's files, served from memory at http://127.0.0.1:<port>/ while the app is open, so a page
/// loads its other files (modules, JSON, pictures, sounds) as it would from any web server. The page
/// sends them with preview_site, only the ones that changed. That address is an origin of its own, apart
/// from the editor's, and a real one, so the page keeps what needs one (Web MIDI and Web Serial need a
/// secure context, which 127.0.0.1 is). Tauri treats it as a remote site, so no command runs from it,
/// although on Windows its scripts are in the frame too. Only this computer can reach it, and only pages
/// from that address can read its files: the Host must be the address itself (so another site can't
/// borrow it with DNS rebinding) and every answer has Cross-Origin-Resource-Policy: same-origin.
#[derive(Default)]
struct Site {
    files: Mutex<HashMap<String, Served>>,
    /// what the page asked for since it last loaded (found or not), so an edit reloads it only when it matters
    asked: Mutex<HashSet<String>>,
    port: Mutex<Option<u16>>,
}

#[derive(Clone)]
struct Served {
    kind: String,
    body: Arc<Vec<u8>>,
}

#[derive(serde::Deserialize)]
struct SiteFile {
    path: String,
    kind: String,
    text: Option<String>,
    /// base64, for pictures
    data: Option<String>,
}

#[derive(Serialize)]
struct SiteState {
    port: u16,
    /// a file the page asked for changed, came or went
    reload: bool,
}

/// The preview's files from now on: `put` (new or changed), and the ones in `keep` as they were.
#[tauri::command]
fn preview_site(app: AppHandle, site: State<Site>, put: Vec<SiteFile>, keep: Vec<String>) -> Result<SiteState, String> {
    let mut next = HashMap::new();
    let mut changed = Vec::new();
    {
        let files = site.files.lock().unwrap();
        for path in keep {
            if let Some(f) = files.get(&path) {
                next.insert(path, f.clone());
            }
        }
        changed.extend(files.keys().filter(|p| !next.contains_key(*p)).cloned());
    }
    for f in put {
        let body = match (f.text, f.data) {
            (Some(text), _) => text.into_bytes(),
            (None, Some(data)) => STANDARD.decode(data.as_bytes()).map_err(|e| format!("{} could not be read: {e}", f.path))?,
            (None, None) => Vec::new(),
        };
        changed.push(f.path.clone());
        next.insert(f.path, Served { kind: f.kind, body: Arc::new(body) });
    }
    *site.files.lock().unwrap() = next;
    // (IntuaCode's own script in the page, .intuicode/preview.js, holds what the page saved: no reload for that)
    let reload = {
        let asked = site.asked.lock().unwrap();
        changed.iter().any(|p| !p.starts_with(".intuicode/") && asked.contains(p))
    };
    Ok(SiteState { port: site_port(&app, &site)?, reload })
}

/// The preview's port, opening it the first time.
fn site_port(app: &AppHandle, site: &Site) -> Result<u16, String> {
    let mut port = site.port.lock().unwrap();
    if let Some(p) = *port {
        return Ok(p);
    }
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|e| format!("The preview's local address could not be opened: {e}"))?;
    let p = listener.local_addr().map_err(|e| e.to_string())?.port();
    let app = app.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            std::thread::spawn(move || answer(&app, stream, p));
        }
    });
    *port = Some(p);
    Ok(p)
}

/// One request to the preview's address: GET or HEAD, then the connection closes.
fn answer(app: &AppHandle, mut stream: TcpStream, port: u16) {
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(15)));
    let mut head = Vec::new();
    let mut buf = [0u8; 4096];
    while !head.windows(4).any(|w| w == b"\r\n\r\n") {
        if head.len() > 32 * 1024 {
            return;
        }
        match stream.read(&mut buf) {
            Ok(0) | Err(_) => return,
            Ok(n) => head.extend_from_slice(&buf[..n]),
        }
    }
    let text = String::from_utf8_lossy(&head).to_string();
    let mut first = text.lines().next().unwrap_or("").split(' ');
    let (method, target) = (first.next().unwrap_or("").to_string(), first.next().unwrap_or("").to_string());
    let header = |name: &str| {
        text.split("\r\n").skip(1).find_map(|l| {
            let (k, v) = l.split_once(':')?;
            k.trim().eq_ignore_ascii_case(name).then(|| v.trim().to_string())
        })
    };
    let ask = Ask {
        method: &method,
        target: &target,
        host: header("host"),
        worker: header("service-worker").is_some(),
    };
    let site = app.state::<Site>();
    let reply = respond(&site.files.lock().unwrap(), &ask, port);
    if let Some(path) = &reply.path {
        let mut asked = site.asked.lock().unwrap();
        // a page loading (in the frame, or anywhere else) starts the list again
        if matches!(header("sec-fetch-dest").as_deref(), Some("iframe" | "document" | "frame")) {
            asked.clear();
        }
        if asked.len() < 5000 {
            asked.insert(path.clone());
        }
        if reply.status == 404 {
            let _ = app.emit("preview-missing", path);
        }
    }
    let _ = stream.write_all(&reply.head());
    if method != "HEAD" {
        let _ = stream.write_all(&reply.body);
    }
    let _ = stream.flush();
}

struct Ask<'a> {
    method: &'a str,
    target: &'a str,
    host: Option<String>,
    /// a service worker's script: the preview doesn't run them (one would stay and answer for the next project)
    worker: bool,
}

struct Reply {
    status: u16,
    kind: String,
    body: Arc<Vec<u8>>,
    location: Option<String>,
    /// the project path asked for, when the request named one
    path: Option<String>,
}

impl Reply {
    fn text(status: u16, text: &str, path: Option<String>) -> Reply {
        Reply { status, kind: "text/plain; charset=utf-8".into(), body: Arc::new(text.as_bytes().to_vec()), location: None, path }
    }

    fn head(&self) -> Vec<u8> {
        let reason = match self.status {
            200 => "OK",
            301 => "Moved Permanently",
            400 => "Bad Request",
            403 => "Forbidden",
            404 => "Not Found",
            _ => "Method Not Allowed",
        };
        let mut h = format!(
            "HTTP/1.1 {} {reason}\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nCross-Origin-Resource-Policy: same-origin\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n",
            self.status,
            self.kind,
            self.body.len()
        );
        if let Some(to) = &self.location {
            h.push_str(&format!("Location: {to}\r\n"));
        }
        if self.status == 405 {
            h.push_str("Allow: GET, HEAD\r\n");
        }
        h.push_str("\r\n");
        h.into_bytes()
    }
}

/// %XX in a URL's path, as UTF-8 text (None if it isn't).
fn percent_decode(s: &str) -> Option<String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = std::str::from_utf8(bytes.get(i + 1..i + 3)?).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// What the preview's address answers: a project file by its path (a folder's index.html for the folder),
/// or a plain 404, as any web server would.
fn respond(files: &HashMap<String, Served>, ask: &Ask, port: u16) -> Reply {
    let own = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    if !ask.host.as_ref().is_some_and(|h| own.iter().any(|o| o.eq_ignore_ascii_case(h))) {
        return Reply::text(403, "This address is IntuaCode's preview, for pages from this address only.", None);
    }
    if ask.method != "GET" && ask.method != "HEAD" {
        return Reply::text(405, "The preview serves files (GET and HEAD), as a plain web server does.", None);
    }
    if ask.worker {
        return Reply::text(403, "IntuaCode's preview doesn't run service workers.", None);
    }
    let raw = ask.target.split(['?', '#']).next().unwrap_or("");
    let Some(decoded) = raw.strip_prefix('/').and_then(percent_decode) else {
        return Reply::text(400, "That isn't a path.", None);
    };
    let parts: Vec<&str> = decoded.split('/').filter(|p| !p.is_empty()).collect();
    if parts.iter().any(|p| *p == "." || *p == ".." || p.contains('\\') || p.contains('\0')) {
        return Reply::text(404, "Not found.", None);
    }
    let mut path = parts.join("/");
    if path.is_empty() || decoded.ends_with('/') {
        path = if path.is_empty() { "index.html".into() } else { format!("{path}/index.html") };
    }
    if let Some(f) = files.get(&path) {
        return Reply { status: 200, kind: f.kind.clone(), body: f.body.clone(), location: None, path: Some(path) };
    }
    if files.contains_key(&format!("{path}/index.html")) {
        let mut r = Reply::text(301, "", None);
        r.location = Some(format!("{raw}/"));
        return r;
    }
    Reply::text(404, &format!("Not found: /{path}\n(It isn't one of the project's files.)\n"), Some(path))
}

/// The page in the preview when the local address can't be used: served at preview://localhost/page-N.html
/// (http://preview.localhost/… on Windows), one page with its CSS and JavaScript inlined. Served from
/// there it has no Content-Security-Policy of the editor's, which forbids inline scripts. Its answers
/// sandbox it into an origin of its own, whatever frame it's in: Tauri treats preview: as the app's own,
/// so a page there with a real origin could use the app's commands.
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
        .header("Content-Security-Policy", "sandbox allow-scripts allow-forms allow-modals")
        .body(body)
        .unwrap()
}

/// The preview's address in the computer's own browser (where a page can use what the app's window
/// doesn't have). Only ever this address: the path is the page's, with anything but plain characters
/// written as %XX, and no shell reads it.
#[tauri::command]
fn open_preview(site: State<Site>, path: String) -> Result<(), String> {
    let port = (*site.port.lock().unwrap()).ok_or("The preview isn't running.")?;
    let safe: String = path
        .bytes()
        .map(|b| if b.is_ascii_alphanumeric() || b"/._-".contains(&b) { (b as char).to_string() } else { format!("%{b:02X}") })
        .collect();
    let url = format!("http://127.0.0.1:{port}/{}", safe.trim_start_matches('/'));
    #[cfg(windows)]
    let mut cmd = {
        let mut c = Command::new("rundll32.exe");
        c.args(["url.dll,FileProtocolHandler", &url]);
        c
    };
    #[cfg(target_os = "macos")]
    let mut cmd = {
        let mut c = Command::new("open");
        c.arg(&url);
        c
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = {
        let mut c = Command::new("xdg-open");
        c.arg(&url);
        c
    };
    quiet(&mut cmd).spawn().map(|_| ()).map_err(|e| format!("The browser could not be opened: {e}"))
}

/* ------------------------------------------------------------------ */
/* A project's own dev server, in the preview                          */
/* ------------------------------------------------------------------ */

/// A React app (any Vite project) runs on its own dev server, `npm run dev`, which the page starts as a program on
/// 127.0.0.1:<target>. The Preview shows it through this relay at 127.0.0.1:<port>: every page gets IntuaCode's
/// helper script first (console lines and errors go to the terminal), and a Content-Security-Policy-Report-Only
/// that blocks nothing: the browser reports each other site the app reaches, and the page is told (preview-host).
/// The relay answers only for its own address (so another site can't borrow it with DNS rebinding) and only ever
/// forwards to the dev server on this computer. Its address is a remote origin to Tauri, so no command runs from
/// the app it shows.
#[derive(Default)]
struct Relay {
    port: Mutex<Option<u16>>,
    target: Mutex<u16>,
    helper: Mutex<Arc<Vec<u8>>>,
}

/// A port nobody is using on this computer, for a dev server.
#[tauri::command]
fn free_port() -> Result<u16, String> {
    let l = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|e| e.to_string())?;
    Ok(l.local_addr().map_err(|e| e.to_string())?.port())
}

/// The relay to the dev server at 127.0.0.1:<target>, and the helper script it puts in each page: its port.
#[tauri::command]
fn preview_relay(app: AppHandle, relay: State<Relay>, target: u16, helper: String) -> Result<u16, String> {
    *relay.target.lock().unwrap() = target;
    *relay.helper.lock().unwrap() = Arc::new(helper.into_bytes());
    let mut port = relay.port.lock().unwrap();
    if let Some(p) = *port {
        return Ok(p);
    }
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(|e| format!("The preview's local address could not be opened: {e}"))?;
    let p = listener.local_addr().map_err(|e| e.to_string())?.port();
    let app = app.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            std::thread::spawn(move || relay_one(&app, stream, p));
        }
    });
    *port = Some(p);
    Ok(p)
}

/// A message's head (up to the blank line) and what came after it in the same reads.
fn read_head(stream: &mut TcpStream) -> Option<(Vec<u8>, Vec<u8>)> {
    let mut got = Vec::new();
    let mut buf = [0u8; 8192];
    loop {
        if let Some(at) = got.windows(4).position(|w| w == b"\r\n\r\n") {
            let rest = got.split_off(at + 4);
            return Some((got, rest));
        }
        if got.len() > 64 * 1024 {
            return None;
        }
        match stream.read(&mut buf) {
            Ok(0) | Err(_) => return None,
            Ok(n) => got.extend_from_slice(&buf[..n]),
        }
    }
}

/// A header's value in a message head.
fn header_of(head: &str, name: &str) -> Option<String> {
    head.split("\r\n").skip(1).find_map(|l| {
        let (k, v) = l.split_once(':')?;
        k.trim().eq_ignore_ascii_case(name).then(|| v.trim().to_string())
    })
}

/// The request as the dev server gets it: its own Host, one request per connection, and (for a page or a file)
/// no compression, so a page can be read and the helper put in. A WebSocket (the dev server's updates) keeps its
/// own headers, to be relayed both ways.
fn relay_head(head: &str, target: u16, websocket: bool) -> String {
    let mut lines = head.split("\r\n");
    let mut out = format!("{}\r\n", lines.next().unwrap_or(""));
    let drop: &[&str] = if websocket { &["host"] } else { &["host", "accept-encoding", "connection", "keep-alive", "upgrade"] };
    for l in lines.filter(|l| !l.is_empty()) {
        let name = l.split(':').next().unwrap_or("").trim().to_ascii_lowercase();
        if !drop.contains(&name.as_str()) && !name.starts_with("proxy-") {
            out.push_str(l);
            out.push_str("\r\n");
        }
    }
    out.push_str(&format!("Host: 127.0.0.1:{target}\r\n"));
    if !websocket {
        out.push_str("Connection: close\r\n");
    }
    out.push_str("\r\n");
    out
}

/// A body sent in chunks, as one (None if it isn't well formed).
fn dechunk(body: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut at = 0;
    loop {
        let line_end = at + body.get(at..)?.windows(2).position(|w| w == b"\r\n")?;
        let size_text = std::str::from_utf8(&body[at..line_end]).ok()?;
        let size = usize::from_str_radix(size_text.split(';').next()?.trim(), 16).ok()?;
        at = line_end + 2;
        if size == 0 {
            return Some(out);
        }
        out.extend_from_slice(body.get(at..at + size)?);
        at += size + 2;
    }
}

/// The page with IntuaCode's helper script first in its head.
fn with_helper(page: &[u8]) -> Vec<u8> {
    const TAG: &[u8] = b"<script src=\"/.intuicode/preview.js\"></script>";
    let low: Vec<u8> = page.iter().map(|b| b.to_ascii_lowercase()).collect();
    // (the tag itself: <head>, not <header>)
    let ends = |i: usize| low.get(i).is_some_and(|&b| b == b'>' || b.is_ascii_whitespace());
    let after = |tag: &[u8]| (0..low.len().saturating_sub(tag.len())).find(|&i| low[i..].starts_with(tag) && ends(i + tag.len()))
        .and_then(|i| low[i..].iter().position(|&b| b == b'>').map(|j| i + j + 1));
    let at = after(b"<head").or_else(|| after(b"<html")).unwrap_or(0);
    [&page[..at], TAG, &page[at..]].concat()
}

/// The other site a Content-Security-Policy report names (the browser's report of a request it would have stopped),
/// as host[:port]; None for the page's own address, inline code and the like.
fn reported_host(report: &[u8]) -> Option<String> {
    let v: serde_json::Value = serde_json::from_slice(report).ok()?;
    let uri = v.get("csp-report")?.get("blocked-uri")?.as_str()?;
    let (scheme, rest) = uri.split_once("://")?;
    if !matches!(scheme, "http" | "https" | "ws" | "wss") {
        return None;
    }
    let host = rest.split(['/', '?', '#']).next()?;
    (!host.is_empty()).then(|| host.to_string())
}

/// What the browser reports against, for each page: nothing is blocked (Report-Only), anything not from the page's
/// own address is reported.
const REPORT_ONLY: &str = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; report-uri /.intuicode/csp";

fn relay_one(app: &AppHandle, mut client: TcpStream, port: u16) {
    let _ = client.set_read_timeout(Some(std::time::Duration::from_secs(30)));
    let Some((head, rest)) = read_head(&mut client) else { return };
    let text = String::from_utf8_lossy(&head).to_string();
    let mut first = text.lines().next().unwrap_or("").split(' ');
    let (method, target) = (first.next().unwrap_or("").to_string(), first.next().unwrap_or("").to_string());
    let plain = |client: &mut TcpStream, status: &str, kind: &str, extra: &str, body: &[u8]| {
        let _ = client.write_all(format!("HTTP/1.1 {status}\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n{extra}\r\n", body.len()).as_bytes());
        let _ = client.write_all(body);
    };
    let own = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
    if !header_of(&text, "host").is_some_and(|h| own.iter().any(|o| o.eq_ignore_ascii_case(&h))) {
        return plain(&mut client, "403 Forbidden", "text/plain; charset=utf-8", "", b"This address is IntuaCode's preview, for pages from this address only.");
    }
    let relay = app.state::<Relay>();
    let path = target.split(['?', '#']).next().unwrap_or("").to_string();
    if path == "/.intuicode/preview.js" {
        let helper = relay.helper.lock().unwrap().clone();
        return plain(&mut client, "200 OK", "text/javascript; charset=utf-8", "", &helper);
    }
    if path == "/.intuicode/csp" {
        let want = header_of(&text, "content-length").and_then(|n| n.parse::<usize>().ok()).unwrap_or(0).min(64 * 1024);
        let mut body = rest;
        let mut buf = [0u8; 4096];
        while body.len() < want {
            match client.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => body.extend_from_slice(&buf[..n]),
            }
        }
        if let Some(host) = reported_host(&body) {
            let _ = app.emit("preview-host", host);
        }
        return plain(&mut client, "204 No Content", "text/plain", "", b"");
    }
    let to = *relay.target.lock().unwrap();
    let Ok(mut up) = TcpStream::connect((Ipv4Addr::LOCALHOST, to)) else {
        // (the dev server is still starting: this page tries again in a moment)
        return plain(&mut client, "503 Service Unavailable", "text/html; charset=utf-8", "Retry-After: 1\r\n", b"<!doctype html><meta http-equiv=\"refresh\" content=\"1\"><body style=\"font:14px sans-serif;color:#888\">The project's dev server is starting\xE2\x80\xA6</body>");
    };
    let websocket = header_of(&text, "upgrade").is_some_and(|u| u.eq_ignore_ascii_case("websocket"));
    if up.write_all(relay_head(&text, to, websocket).as_bytes()).is_err() || up.write_all(&rest).is_err() {
        return;
    }
    if websocket {
        // both ways, until either side closes
        let (Ok(mut c2), Ok(mut u2)) = (client.try_clone(), up.try_clone()) else { return };
        let _ = client.set_read_timeout(None);
        std::thread::spawn(move || {
            let _ = std::io::copy(&mut u2, &mut c2);
            let _ = c2.shutdown(std::net::Shutdown::Both);
        });
        let _ = std::io::copy(&mut client, &mut up);
        let _ = up.shutdown(std::net::Shutdown::Both);
        return;
    }
    // the rest of the request's body, then the answer: a page gets the helper and the report-only policy, anything
    // else goes through as it is
    let want = header_of(&text, "content-length").and_then(|n| n.parse::<u64>().ok()).unwrap_or(0).saturating_sub(rest.len() as u64);
    if want > 0 && std::io::copy(&mut (&mut client).take(want), &mut up).is_err() {
        return;
    }
    let Some((rhead, rrest)) = read_head(&mut up) else { return };
    let rtext = String::from_utf8_lossy(&rhead).to_string();
    let page = header_of(&rtext, "content-type").is_some_and(|t| t.to_ascii_lowercase().starts_with("text/html"));
    if !page || method == "HEAD" {
        let _ = client.write_all(&rhead);
        let _ = client.write_all(&rrest);
        let _ = std::io::copy(&mut up, &mut client);
        return;
    }
    let mut body = rrest;
    let _ = up.read_to_end(&mut body);
    if header_of(&rtext, "transfer-encoding").is_some_and(|t| t.to_ascii_lowercase().contains("chunked")) {
        body = dechunk(&body).unwrap_or(body);
    }
    let body = with_helper(&body);
    let mut lines = rtext.split("\r\n");
    let mut out = format!("{}\r\n", lines.next().unwrap_or("HTTP/1.1 200 OK"));
    for l in lines.filter(|l| !l.is_empty()) {
        let name = l.split(':').next().unwrap_or("").trim().to_ascii_lowercase();
        if !matches!(name.as_str(), "content-length" | "transfer-encoding" | "connection" | "content-security-policy-report-only") {
            out.push_str(l);
            out.push_str("\r\n");
        }
    }
    out.push_str(&format!("Content-Length: {}\r\nConnection: close\r\nContent-Security-Policy-Report-Only: {REPORT_ONLY}\r\n\r\n", body.len()));
    let _ = client.write_all(out.as_bytes());
    let _ = client.write_all(&body);
}

/* ------------------------------------------------------------------ */
/* Closing the window                                                  */
/* ------------------------------------------------------------------ */

/// Whether the project has changes since it was last saved, as the page says. While it has, closing the
/// window asks the page first (ask-to-close): it offers to save, then closes the window with close_window.
/// Off, the window closes as any window does, so a page that can't answer never keeps it open.
#[derive(Default)]
struct CloseGuard(AtomicBool);

#[tauri::command]
fn guard_close(guard: State<CloseGuard>, on: bool) {
    guard.0.store(on, Ordering::SeqCst);
}

/// Close the window after all (the page asked first). This doesn't ask again.
#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.destroy().map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(Processes::default())
        .manage(Compiler::default())
        .manage(Access::default())
        .manage(Preview::default())
        .manage(Site::default())
        .manage(Relay::default())
        .manage(CloseGuard::default())
        .register_uri_scheme_protocol("preview", |ctx, request| preview_page(ctx.app_handle(), request.uri().path()))
        .setup(|_app| {
            #[cfg(unix)]
            end_on_signals(_app.handle().clone());
            Ok(())
        })
        // The window takes a drop of files or folders before the page sees it (the page gets them
        // as paths). The person chose those, as in the folder dialog, so the window may read them.
        // (A page can send a pretend drop to itself, but it doesn't reach here.)
        .on_window_event(|window, event| match event {
            WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) => {
                let access = window.state::<Access>();
                for path in paths {
                    access.allow_folder(path);
                }
            }
            // changes not saved: the page asks whether to save them, and closes the window itself
            WindowEvent::CloseRequested { api, .. } if window.state::<CloseGuard>().0.load(Ordering::SeqCst) => {
                api.prevent_close();
                let _ = window.emit("ask-to-close", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            read_folder, read_text, write_text, read_bytes, write_bytes, list_files, scratch_folder, pick_folder, set_preview,
            preview_site, open_preview, free_port, preview_relay, run_program, run_shell, write_stdin, stop_program, find_python, find_git, find_cpp,
            compile_cpp, find_arduino, run_capture, find_venv, guard_close, close_window
        ])
        .build(tauri::generate_context!())
        .expect("IntuaCode could not start")
        .run(|app, event| {
            // a program still running (a web server, say) ends with the app, rather than carrying
            // on unseen and keeping its port
            if let RunEvent::Exit = event {
                let running: Vec<_> = app.state::<Processes>().children.lock().unwrap().drain().map(|(_, child)| child).collect();
                for child in running {
                    end(&child);
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_relay_asks_the_dev_server_for_one_plain_answer() {
        let head = "GET /src/main.tsx HTTP/1.1\r\nHost: 127.0.0.1:5000\r\nAccept-Encoding: gzip, br\r\nConnection: keep-alive\r\nProxy-Authorization: x\r\nAccept: */*\r\n\r\n";
        let out = relay_head(head, 5173, false);
        assert!(out.starts_with("GET /src/main.tsx HTTP/1.1\r\n"));
        assert!(out.contains("Host: 127.0.0.1:5173\r\n") && out.contains("Connection: close\r\n") && out.contains("Accept: */*\r\n"));
        assert!(!out.contains("gzip") && !out.contains("keep-alive") && !out.contains("Proxy-") && !out.contains("5000"));
        assert!(out.ends_with("\r\n\r\n"));
        // a WebSocket keeps its own Connection and Upgrade headers
        let ws = relay_head("GET /?token=1 HTTP/1.1\r\nHost: 127.0.0.1:5000\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Key: k\r\n\r\n", 5173, true);
        assert!(ws.contains("Connection: Upgrade\r\n") && ws.contains("Upgrade: websocket\r\n") && ws.contains("Sec-WebSocket-Key: k\r\n") && ws.contains("Host: 127.0.0.1:5173\r\n"));
    }

    #[test]
    fn a_page_gets_the_helper_first_and_chunks_are_joined() {
        assert_eq!(with_helper(b"<!doctype html><html><HEAD><title>x</title>"), b"<!doctype html><html><HEAD><script src=\"/.intuicode/preview.js\"></script><title>x</title>".to_vec());
        assert_eq!(with_helper(b"<p>no head</p>"), b"<script src=\"/.intuicode/preview.js\"></script><p>no head</p>".to_vec());
        assert_eq!(with_helper(b"<html lang=\"en\"><header>x</header>"), b"<html lang=\"en\"><script src=\"/.intuicode/preview.js\"></script><header>x</header>".to_vec());
        assert_eq!(with_helper(b"<head\n  data-x=\"1\"><title>"), b"<head\n  data-x=\"1\"><script src=\"/.intuicode/preview.js\"></script><title>".to_vec());
        assert_eq!(dechunk(b"5\r\nhello\r\n6;x=1\r\n world\r\n0\r\n\r\n"), Some(b"hello world".to_vec()));
        assert_eq!(dechunk(b"zz\r\n"), None);
    }

    #[test]
    fn a_report_names_the_other_site() {
        let r = br#"{"csp-report":{"document-uri":"http://127.0.0.1:5000/","blocked-uri":"https://abc.supabase.co/rest/v1/notes?select=*","violated-directive":"connect-src"}}"#;
        assert_eq!(reported_host(r).as_deref(), Some("abc.supabase.co"));
        assert_eq!(reported_host(br#"{"csp-report":{"blocked-uri":"wss://rt.example.com:443/socket"}}"#).as_deref(), Some("rt.example.com:443"));
        assert_eq!(reported_host(br#"{"csp-report":{"blocked-uri":"inline"}}"#), None);
        assert_eq!(reported_host(b"not json"), None);
    }

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

    #[test]
    fn the_preview_serves_the_projects_files_and_nothing_else() {
        let served = |kind: &str, text: &str| Served { kind: kind.into(), body: Arc::new(text.as_bytes().to_vec()) };
        let mut files = HashMap::new();
        files.insert("index.html".to_string(), served("text/html; charset=utf-8", "<p>home</p>"));
        files.insert("app.js".to_string(), served("text/javascript; charset=utf-8", "export {}"));
        files.insert("my page.html".to_string(), served("text/html; charset=utf-8", "<p>spaces</p>"));
        files.insert("docs/index.html".to_string(), served("text/html; charset=utf-8", "<p>docs</p>"));
        let host = Some("127.0.0.1:5000".to_string());
        let get = |target: &str| respond(&files, &Ask { method: "GET", target, host: host.clone(), worker: false }, 5000);
        let home = get("/");
        assert_eq!((home.status, home.body.as_slice()), (200, b"<p>home</p>".as_slice()));
        assert_eq!(get("/app.js?v=20260927").status, 200);   // a query (cache-busting) isn't part of the path
        assert_eq!(get("/my%20page.html").status, 200);
        assert_eq!(get("/docs/").body.as_slice(), b"<p>docs</p>");
        let folder = get("/docs");
        assert_eq!((folder.status, folder.location.as_deref()), (301, Some("/docs/")));
        // not in the project: a plain 404, and the path is noted (the page asked for it)
        let missing = get("/assets/audio/omni-84/c4.ogg");
        assert_eq!((missing.status, missing.path.as_deref()), (404, Some("assets/audio/omni-84/c4.ogg")));
        assert_eq!(get("/../secret.txt").status, 404);
        assert_eq!(get("/%2e%2e/secret.txt").status, 404);
        assert_eq!(get("/bad%zz").status, 400);
        // another site's name for this address (DNS rebinding) gets nothing
        let other = respond(&files, &Ask { method: "GET", target: "/", host: Some("evil.example:5000".into()), worker: false }, 5000);
        assert_eq!(other.status, 403);
        assert_eq!(respond(&files, &Ask { method: "GET", target: "/", host: None, worker: false }, 5000).status, 403);
        assert_eq!(respond(&files, &Ask { method: "POST", target: "/", host: host.clone(), worker: false }, 5000).status, 405);
        assert_eq!(respond(&files, &Ask { method: "GET", target: "/app.js", host: host.clone(), worker: true }, 5000).status, 403);
        let head = String::from_utf8(home.head()).unwrap();
        assert!(head.contains("Cross-Origin-Resource-Policy: same-origin\r\n") && head.contains("Content-Length: 11\r\n"));
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn programs_get_the_settings_from_before_the_appimage() {
        let appdir = "/tmp/.mount_IntuCoAbc123";
        let vars = [
            ("APPDIR", appdir.to_string()),
            ("APPIMAGE", "/home/sam/IntuaCode.AppImage".into()),
            ("GTK_THEME", "Adwaita:dark".into()),
            ("GTK_PATH", format!("{appdir}//usr/lib/gtk-3.0")),
            ("XDG_DATA_DIRS", format!("{appdir}/usr/share:/usr/share:/usr/local/share")),
            ("PATH", "/usr/bin:/bin".into()),
            ("HOME", "/home/sam".into()),
        ]
        .map(|(k, v)| (OsString::from(k), OsString::from(v)));
        let mut changes = outside_appimage(vars.into_iter(), OsStr::new(appdir));
        changes.sort();
        let removed = |k: &str| (OsString::from(k), None);
        assert_eq!(changes, vec![
            removed("APPDIR"),
            removed("APPIMAGE"),
            removed("GTK_PATH"),
            removed("GTK_THEME"),
            (OsString::from("XDG_DATA_DIRS"), Some(OsString::from("/usr/share:/usr/local/share"))),
        ]);
    }

    #[cfg(unix)]
    #[test]
    fn a_projects_own_python() {
        let dir = std::env::temp_dir().join(format!("intuicode-venv-{}", std::process::id()));
        std::fs::create_dir_all(dir.join(".venv/bin")).unwrap();
        assert_eq!(venv_in(&dir), None); // a folder called .venv without a Python isn't one
        std::fs::write(dir.join(".venv/bin/python3"), "").unwrap();
        assert_eq!(venv_in(&dir), None); // nor is one python3 -m venv couldn't finish
        std::fs::write(dir.join(".venv/bin/activate"), "").unwrap();
        assert_eq!(venv_in(&dir), Some(dir.join(".venv")));
        let mut cmd = Command::new("python3");
        use_venv(&mut cmd, &dir);
        let path = cmd.get_envs().find(|(k, _)| *k == "PATH").and_then(|(_, v)| v).unwrap().to_string_lossy().to_string();
        assert!(path.starts_with(&dir.join(".venv/bin").to_string_lossy().to_string()));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
