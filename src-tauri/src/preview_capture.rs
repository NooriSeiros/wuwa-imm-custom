use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Deserialize)]
pub struct CaptureCrop {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

#[derive(Deserialize)]
pub struct ScreenCaptureCrop {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Serialize, Clone)]
pub struct CaptureBounds {
    left: i32,
    top: i32,
    width: u32,
    height: u32,
}

#[derive(Clone)]
struct StoredWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

static WINDOW_STATE_BEFORE_CAPTURE: Lazy<Mutex<Option<StoredWindowState>>> = Lazy::new(|| Mutex::new(None));

fn timestamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(windows)]
fn game_title(game_id: i32) -> &'static str {
    match game_id {
        0 => "wuthering waves",
        1 => "zenlesszonezero",
        2 => "genshin impact",
        3 => "honkai: star rail",
        4 => "endfield",
        _ => "wuthering waves",
    }
}

#[cfg(windows)]
fn find_game_window(game_id: i32) -> Result<winapi::shared::windef::HWND, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{EnumWindows, GetWindowTextW, IsWindowVisible};

    struct FindData {
        target: String,
        hwnd: HWND,
    }

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: isize) -> i32 {
        let data = &mut *(lparam as *mut FindData);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        if len <= 0 {
            return 1;
        }

        let title = OsString::from_wide(&buffer[..len as usize])
            .to_string_lossy()
            .to_lowercase();

        if title.contains(&data.target) {
            data.hwnd = hwnd;
            return 0;
        }

        1
    }

    let mut data = FindData {
        target: game_title(game_id).to_string(),
        hwnd: std::ptr::null_mut(),
    };

    unsafe {
        EnumWindows(Some(enum_proc), &mut data as *mut _ as isize);
    }

    if data.hwnd.is_null() {
        Err("Game window not found. Open the game first.".to_string())
    } else {
        Ok(data.hwnd)
    }
}

#[cfg(windows)]
fn game_window_rect(hwnd: winapi::shared::windef::HWND) -> Result<(i32, i32, u32, u32), String> {
    use winapi::shared::windef::RECT;
    use winapi::um::winuser::GetWindowRect;

    let mut rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };

    unsafe {
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return Err("Could not read game window bounds.".to_string());
        }
    }

    let width = (rect.right - rect.left).max(1) as u32;
    let height = (rect.bottom - rect.top).max(1) as u32;
    Ok((rect.left, rect.top, width, height))
}

#[cfg(windows)]
fn screen_for_point(x: i32, y: i32) -> Result<screenshots::Screen, String> {
    let screens = screenshots::Screen::all().map_err(|e| e.to_string())?;
    screens
        .into_iter()
        .find(|screen| {
            let info = &screen.display_info;
            x >= info.x
                && x < info.x + info.width as i32
                && y >= info.y
                && y < info.y + info.height as i32
        })
        .ok_or_else(|| "No screen found to capture.".to_string())
}

#[cfg(windows)]
fn restore_main_window(app_handle: &tauri::AppHandle) {
    use tauri::Manager;

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_always_on_top(false);
        let _ = window.unminimize();
        let _ = window.show();
        if let Ok(mut state) = WINDOW_STATE_BEFORE_CAPTURE.lock() {
            if let Some(stored) = state.take() {
                let _ = window.set_position(tauri::PhysicalPosition::new(stored.x, stored.y));
                let _ = window.set_size(tauri::PhysicalSize::new(stored.width, stored.height));
            }
        }
        let _ = window.set_focus();
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn enter_preview_capture_overlay(
    app_handle: tauri::AppHandle,
    game_id: i32,
) -> Result<CaptureBounds, String> {
    use tauri::Manager;
    use winapi::um::winuser::SetForegroundWindow;

    let hwnd = find_game_window(game_id)?;
    let (left, top, width, height) = game_window_rect(hwnd)?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found.".to_string())?;

    if let (Ok(position), Ok(size)) = (window.outer_position(), window.outer_size()) {
        if let Ok(mut state) = WINDOW_STATE_BEFORE_CAPTURE.lock() {
            if state.is_none() {
                *state = Some(StoredWindowState {
                    x: position.x,
                    y: position.y,
                    width: size.width,
                    height: size.height,
                });
            }
        }
    }

    unsafe {
        SetForegroundWindow(hwnd);
    }
    std::thread::sleep(Duration::from_millis(250));

    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window
        .set_position(tauri::PhysicalPosition::new(left, top))
        .map_err(|e| e.to_string())?;
    window
        .set_size(tauri::PhysicalSize::new(width, height))
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(CaptureBounds {
        left,
        top,
        width,
        height,
    })
}

#[cfg(not(windows))]
#[tauri::command]
pub fn enter_preview_capture_overlay(
    _app_handle: tauri::AppHandle,
    _game_id: i32,
) -> Result<CaptureBounds, String> {
    Err("Preview capture is only supported on Windows.".to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn cancel_preview_capture_overlay(app_handle: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(false);
    }
    restore_main_window(&app_handle);
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
pub fn pause_preview_capture_overlay(
    app_handle: tauri::AppHandle,
    game_id: i32,
) -> Result<(), String> {
    use tauri::Manager;
    use winapi::um::winuser::{GetAsyncKeyState, SetForegroundWindow, VK_RBUTTON};

    let game_hwnd = find_game_window(game_id)?;
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found.".to_string())?;

    window
        .set_ignore_cursor_events(true)
        .map_err(|e| e.to_string())?;

    unsafe {
        SetForegroundWindow(game_hwnd);
    }

    loop {
        let pressed = unsafe { (GetAsyncKeyState(VK_RBUTTON) as u16 & 0x8000) != 0 };
        if !pressed {
            break;
        }
        std::thread::sleep(Duration::from_millis(16));
    }

    window
        .set_ignore_cursor_events(false)
        .map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn pause_preview_capture_overlay(
    _app_handle: tauri::AppHandle,
    _game_id: i32,
) -> Result<(), String> {
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn cancel_preview_capture_overlay(_app_handle: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
pub fn capture_preview_screen_region(
    app_handle: tauri::AppHandle,
    crop: ScreenCaptureCrop,
) -> Result<String, String> {
    use tauri::Manager;

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }

    std::thread::sleep(Duration::from_millis(180));

    let result = (|| {
        let screen = screen_for_point(crop.x, crop.y)?;
        let info = &screen.display_info;
        let image = screen
            .capture_area(crop.x - info.x, crop.y - info.y, crop.width.max(1), crop.height.max(1))
            .map_err(|e| e.to_string())?;
        let stage_path = std::env::temp_dir().join(format!("wwmi-preview-crop-{}.png", timestamp()));
        image.save(&stage_path).map_err(|e| e.to_string())?;
        Ok(stage_path.to_string_lossy().to_string())
    })();

    restore_main_window(&app_handle);
    result
}

#[cfg(not(windows))]
#[tauri::command]
pub fn capture_preview_screen_region(
    _app_handle: tauri::AppHandle,
    _crop: ScreenCaptureCrop,
) -> Result<String, String> {
    Err("Preview capture is only supported on Windows.".to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn capture_game_window_preview_stage(
    app_handle: tauri::AppHandle,
    game_id: i32,
) -> Result<String, String> {
    use screenshots::Screen;
    use tauri::Manager;
    use winapi::um::winuser::SetForegroundWindow;

    let hwnd = find_game_window(game_id)?;
    let main_window = app_handle.get_webview_window("main");

    if let Some(window) = &main_window {
        let _ = window.minimize();
    }

    let result = (|| {
        unsafe {
            SetForegroundWindow(hwnd);
        }
        std::thread::sleep(Duration::from_millis(700));

        let (left, top, width, height) = game_window_rect(hwnd)?;
        let center_x = left + (width as i32 / 2);
        let center_y = top + (height as i32 / 2);
        let screens = Screen::all().map_err(|e| e.to_string())?;
        let screen = screens
            .iter()
            .find(|screen| {
                let info = &screen.display_info;
                center_x >= info.x
                    && center_x < info.x + info.width as i32
                    && center_y >= info.y
                    && center_y < info.y + info.height as i32
            })
            .or_else(|| screens.first())
            .ok_or_else(|| "No screen found to capture.".to_string())?;

        let info = &screen.display_info;
        let image = screen
            .capture_area(left - info.x, top - info.y, width, height)
            .map_err(|e| e.to_string())?;

        let stage_path = std::env::temp_dir().join(format!("wwmi-preview-stage-{}.png", timestamp()));
        image.save(&stage_path).map_err(|e| e.to_string())?;
        Ok(stage_path.to_string_lossy().to_string())
    })();

    if let Some(window) = &main_window {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }

    result
}

#[cfg(not(windows))]
#[tauri::command]
pub fn capture_game_window_preview_stage(
    _app_handle: tauri::AppHandle,
    _game_id: i32,
) -> Result<String, String> {
    Err("Preview capture is only supported on Windows.".to_string())
}

fn backup_existing_previews(mod_dir: &Path) -> Result<(), String> {
    let preview_exts = ["png", "jpg", "jpeg", "webp", "gif"];
    let existing: Vec<PathBuf> = preview_exts
        .iter()
        .map(|ext| mod_dir.join(format!("preview.{}", ext)))
        .filter(|path| path.is_file())
        .collect();

    if existing.is_empty() {
        return Ok(());
    }

    let backup_dir = mod_dir
        .join("_preview_backups")
        .join(format!("{}", timestamp()));
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    for preview in existing {
        if let Some(file_name) = preview.file_name() {
            std::fs::rename(&preview, backup_dir.join(file_name)).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn save_mod_preview_from_capture(
    stage_path: String,
    mod_path: String,
    crop: CaptureCrop,
) -> Result<(), String> {
    let mod_dir = Path::new(&mod_path);
    if !mod_dir.is_dir() {
        return Err("Mod folder not found.".to_string());
    }

    let stage = Path::new(&stage_path);
    if !stage.is_file() {
        return Err("Capture image not found.".to_string());
    }

    let image = image::open(stage).map_err(|e| e.to_string())?;
    let image_width = image.width();
    let image_height = image.height();

    let x = crop.x.min(image_width.saturating_sub(1));
    let y = crop.y.min(image_height.saturating_sub(1));
    let width = crop.width.min(image_width.saturating_sub(x)).max(1);
    let height = crop.height.min(image_height.saturating_sub(y)).max(1);

    let cropped = image.crop_imm(x, y, width, height);
    let final_image = if cropped.height() > 1200 {
        let new_height = 1200;
        let new_width = ((cropped.width() as f32 / cropped.height() as f32) * new_height as f32).round() as u32;
        cropped.resize(new_width.max(1), new_height, image::imageops::FilterType::Lanczos3)
    } else {
        cropped
    };

    backup_existing_previews(mod_dir)?;
    final_image
        .save(mod_dir.join("preview.png"))
        .map_err(|e| e.to_string())?;

    let _ = std::fs::remove_file(stage);
    Ok(())
}

#[tauri::command]
pub fn save_mod_preview_stage(stage_path: String, mod_path: String) -> Result<(), String> {
    let mod_dir = Path::new(&mod_path);
    if !mod_dir.is_dir() {
        return Err("Mod folder not found.".to_string());
    }

    let stage = Path::new(&stage_path);
    if !stage.is_file() {
        return Err("Capture image not found.".to_string());
    }

    let image = image::open(stage).map_err(|e| e.to_string())?;
    let final_image = if image.height() > 1200 {
        let new_height = 1200;
        let new_width = ((image.width() as f32 / image.height() as f32) * new_height as f32).round() as u32;
        image.resize(new_width.max(1), new_height, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };

    backup_existing_previews(mod_dir)?;
    final_image
        .save(mod_dir.join("preview.png"))
        .map_err(|e| e.to_string())?;

    let _ = std::fs::remove_file(stage);
    Ok(())
}

#[tauri::command]
pub fn save_preset_cover_stage(
	app_handle: tauri::AppHandle,
	stage_path: String,
	cover_key: String,
) -> Result<String, String> {
    use tauri::Manager;

    let stage = Path::new(&stage_path);
    if !stage.is_file() {
        return Err("Capture image not found.".to_string());
    }

    let image = image::open(stage).map_err(|e| e.to_string())?;
    let final_image = if image.height() > 1200 {
        let new_height = 1200;
        let new_width = ((image.width() as f32 / image.height() as f32) * new_height as f32).round() as u32;
        image.resize(new_width.max(1), new_height, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };

    let safe_key: String = cover_key
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect();
    let file_name = if safe_key.trim_matches('_').is_empty() {
        format!("preset_{}", timestamp())
    } else {
        safe_key
    };
    let covers_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("preset-covers");
    std::fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;
    let cover_path = covers_dir.join(format!("{}.png", file_name));
    final_image.save(&cover_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(stage);

    Ok(cover_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_look_cover_stage(
    app_handle: tauri::AppHandle,
    stage_path: String,
    cover_key: String,
) -> Result<String, String> {
    use tauri::Manager;

    let stage = Path::new(&stage_path);
    if !stage.is_file() {
        return Err("Capture image not found.".to_string());
    }

    let image = image::open(stage).map_err(|e| e.to_string())?;
    let final_image = if image.height() > 1200 {
        let new_height = 1200;
        let new_width = ((image.width() as f32 / image.height() as f32) * new_height as f32).round() as u32;
        image.resize(new_width.max(1), new_height, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };

    let safe_key: String = cover_key
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect();
    let file_name = if safe_key.trim_matches('_').is_empty() {
        format!("look_{}", timestamp())
    } else {
        safe_key
    };
    let covers_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("look-covers");
    std::fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;
    let cover_path = covers_dir.join(format!("{}.png", file_name));
    final_image.save(&cover_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(stage);

    Ok(cover_path.to_string_lossy().to_string())
}
