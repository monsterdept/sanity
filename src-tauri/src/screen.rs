//! The terminal, while `sanity check` is watching a run.
//!
//! **Two things a plain stream of `println!` cannot do**, and both were asked for by
//! watching one: the column header scrolls away after twenty readings, so the numbers stop
//! saying what they are; and there is no way to stop WATCHING a run without stopping the
//! run, because the only key the terminal delivers is the one that kills it.
//!
//! Neither wants a TUI framework, and the first attempt at the first one wanted too much: a
//! DECSTBM scroll region is defined in ABSOLUTE screen rows, so pinning "the top two lines"
//! pins rows 1 and 2 of the display rather than whatever was last printed — the header sat
//! inside the region and scrolled away, shedding fragments of itself as the readings
//! overwrote it. Fixing that meant clearing the screen and owning it.
//!
//! The simpler shape wins: `check` redraws a small block in place with relative cursor
//! motion, and never prints more than fits. Nothing scrolls, so nothing scrolls off, and no
//! escape sequence outlives the command. What is left here is the one thing that genuinely
//! needs the terminal's cooperation — reading a keystroke without waiting for a newline.

/// Keys, without waiting for a newline.
///
/// **ICANON and ECHO off, ISIG left ON.** Turning off signals too is what "raw mode" usually
/// means, and it would take Ctrl-C with it — the key this command promises stops the run. So
/// this is the smallest possible change: bytes arrive as they are typed, the terminal does
/// not echo them, and every signal still works.
#[cfg(unix)]
pub struct Keys(libc::termios);

#[cfg(unix)]
impl Keys {
    pub fn capture() -> Option<Keys> {
        use std::io::IsTerminal;
        if !std::io::stdin().is_terminal() {
            return None;
        }
        unsafe {
            let mut before: libc::termios = std::mem::zeroed();
            if libc::tcgetattr(libc::STDIN_FILENO, &mut before) != 0 {
                return None;
            }
            let mut raw = before;
            raw.c_lflag &= !(libc::ICANON | libc::ECHO);
            // One byte, no timeout: the reader thread blocks until something is typed.
            raw.c_cc[libc::VMIN] = 1;
            raw.c_cc[libc::VTIME] = 0;
            if libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &raw) != 0 {
                return None;
            }
            Some(Keys(before))
        }
    }
}

#[cfg(unix)]
impl Drop for Keys {
    fn drop(&mut self) {
        // Restored however this ends. A terminal left with ECHO off looks broken in a way
        // that outlives the command and is not obviously its fault.
        unsafe {
            libc::tcsetattr(libc::STDIN_FILENO, libc::TCSANOW, &self.0);
        }
    }
}

#[cfg(not(unix))]
pub struct Keys;

#[cfg(not(unix))]
impl Keys {
    pub fn capture() -> Option<Keys> {
        None
    }
}
