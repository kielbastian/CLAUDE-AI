//go:build windows

// Kreator Folderów — przeciągnij plik .txt/.nc na ikonę programu (lub na jego
// okno), a na Pulpicie powstanie folder o nazwie z pierwszego nawiasu w pliku
// i zostanie do niego skopiowany przeciągnięty plik.
package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var (
	user32   = syscall.NewLazyDLL("user32.dll")
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	gdi32    = syscall.NewLazyDLL("gdi32.dll")
	shell32  = syscall.NewLazyDLL("shell32.dll")

	pRegisterClassExW    = user32.NewProc("RegisterClassExW")
	pCreateWindowExW     = user32.NewProc("CreateWindowExW")
	pDefWindowProcW      = user32.NewProc("DefWindowProcW")
	pGetMessageW         = user32.NewProc("GetMessageW")
	pTranslateMessage    = user32.NewProc("TranslateMessage")
	pDispatchMessageW    = user32.NewProc("DispatchMessageW")
	pPostQuitMessage     = user32.NewProc("PostQuitMessage")
	pLoadCursorW         = user32.NewProc("LoadCursorW")
	pMessageBoxW         = user32.NewProc("MessageBoxW")
	pShowWindow          = user32.NewProc("ShowWindow")
	pUpdateWindow        = user32.NewProc("UpdateWindow")
	pSendMessageW        = user32.NewProc("SendMessageW")
	pSetWindowLongPtrW   = user32.NewProc("SetWindowLongPtrW")
	pCallWindowProcW     = user32.NewProc("CallWindowProcW")
	pGetSystemMetrics    = user32.NewProc("GetSystemMetrics")
	pCreateFontW         = gdi32.NewProc("CreateFontW")
	pMultiByteToWideChar = kernel32.NewProc("MultiByteToWideChar")
	pGetModuleHandleW    = kernel32.NewProc("GetModuleHandleW")
	pDragAcceptFiles     = shell32.NewProc("DragAcceptFiles")
	pDragQueryFileW      = shell32.NewProc("DragQueryFileW")
	pDragFinish          = shell32.NewProc("DragFinish")
	pSHGetFolderPathW    = shell32.NewProc("SHGetFolderPathW")
	pShellExecuteW       = shell32.NewProc("ShellExecuteW")
)

const (
	wsOverlapped      = 0x00000000
	wsCaption         = 0x00C00000
	wsSysMenu         = 0x00080000
	wsMinimizeBox     = 0x00020000
	wsVisible         = 0x10000000
	wsChild           = 0x40000000
	wsVScroll         = 0x00200000
	wsBorder          = 0x00800000
	esMultiline       = 0x0004
	esAutoVScroll     = 0x0040
	esReadonly        = 0x0800
	ssCenter          = 0x0001
	wmDestroy         = 0x0002
	wmSetFont         = 0x0030
	wmDropFiles       = 0x0233
	emSetSel          = 0x00B1
	emReplaceSel      = 0x00C2
	mbOK              = 0x0000
	mbIconInformation = 0x0040
	mbIconWarning     = 0x0030
	swShownormal      = 1
	smCxScreen        = 0
	smCyScreen        = 1
	idcArrow          = 32512
	colorBtnFace      = 15
	csidlDesktopDir   = 0x0010
	gwlpWndProc       = -4
	winW              = 560
	winH              = 470
)

var (
	hLog        uintptr
	oldEditProc uintptr
)

func utf16Ptr(s string) *uint16 {
	p, _ := syscall.UTF16PtrFromString(s)
	return p
}

// decodeACP zamienia bajty z pliku na tekst; znaki spoza ASCII interpretuje
// w systemowej stronie kodowej (na polskim Windows: CP1250).
func decodeACP(b []byte) string {
	ascii := true
	for _, c := range b {
		if c >= 0x80 {
			ascii = false
			break
		}
	}
	if ascii {
		return string(b)
	}
	n, _, _ := pMultiByteToWideChar.Call(0, 0, uintptr(unsafe.Pointer(&b[0])), uintptr(len(b)), 0, 0)
	if n == 0 {
		return string(b)
	}
	buf := make([]uint16, n)
	pMultiByteToWideChar.Call(0, 0, uintptr(unsafe.Pointer(&b[0])), uintptr(len(b)),
		uintptr(unsafe.Pointer(&buf[0])), n)
	return syscall.UTF16ToString(buf)
}

func desktopDir() (string, error) {
	buf := make([]uint16, syscall.MAX_PATH)
	r, _, _ := pSHGetFolderPathW.Call(0, csidlDesktopDir, 0, 0, uintptr(unsafe.Pointer(&buf[0])))
	if r != 0 {
		return "", fmt.Errorf("nie mozna ustalic sciezki Pulpitu")
	}
	return syscall.UTF16ToString(buf), nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// processFile tworzy folder na Pulpicie i kopiuje do niego plik.
// Zwraca komunikat dla użytkownika oraz ścieżkę folderu (gdy się udało).
func processFile(path string) (msg string, folder string) {
	base := filepath.Base(path)
	fi, err := os.Stat(path)
	if err != nil || fi.IsDir() {
		return "BŁĄD — " + base + " — to nie jest plik.", ""
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "BŁĄD — " + base + " — nie można odczytać pliku.", ""
	}
	raw := ExtractRawName(data)
	if raw == nil {
		return "BŁĄD — " + base + " — nie znaleziono nazwy w nawiasie.", ""
	}
	name := SanitizeName(decodeACP(raw))
	if name == "" {
		return "BŁĄD — " + base + " — nazwa w nawiasie jest pusta.", ""
	}
	desktop, err := desktopDir()
	if err != nil {
		return "BŁĄD — " + base + " — " + err.Error(), ""
	}
	folder = filepath.Join(desktop, name)
	existed := false
	if st, err := os.Stat(folder); err == nil && st.IsDir() {
		existed = true
	} else if err := os.Mkdir(folder, 0o777); err != nil {
		return "BŁĄD — " + base + " — nie można utworzyć folderu „" + name + "”.", ""
	}
	dst := filepath.Join(folder, base)
	if _, err := os.Stat(dst); err == nil {
		return "OK — Folder „" + name + "” — plik " + base + " już w nim jest.", folder
	}
	if err := copyFile(path, dst); err != nil {
		return "BŁĄD — Utworzono folder „" + name + "”, ale nie udało się skopiować pliku " + base + ".", folder
	}
	if existed {
		return "OK — Skopiowano " + base + " do istniejącego folderu „" + name + "”.", folder
	}
	return "OK — Utworzono na Pulpicie folder „" + name + "” i skopiowano " + base + ".", folder
}

func processAll(paths []string) (msgs []string, folders map[string]bool) {
	folders = map[string]bool{}
	for _, p := range paths {
		msg, folder := processFile(p)
		msgs = append(msgs, msg)
		if folder != "" {
			folders[folder] = true
		}
	}
	return
}

func openInExplorer(dir string) {
	pShellExecuteW.Call(0, uintptr(unsafe.Pointer(utf16Ptr("open"))),
		uintptr(unsafe.Pointer(utf16Ptr(dir))), 0, 0, swShownormal)
}

func appendLog(line string) {
	if hLog == 0 {
		return
	}
	end := uintptr(0x7FFFFFFF)
	pSendMessageW.Call(hLog, emSetSel, end, end)
	pSendMessageW.Call(hLog, emReplaceSel, 0,
		uintptr(unsafe.Pointer(utf16Ptr(line+"\r\n"))))
}

func handleDrop(hDrop uintptr) {
	count, _, _ := pDragQueryFileW.Call(hDrop, 0xFFFFFFFF, 0, 0)
	var paths []string
	for i := uintptr(0); i < count; i++ {
		n, _, _ := pDragQueryFileW.Call(hDrop, i, 0, 0)
		buf := make([]uint16, n+1)
		pDragQueryFileW.Call(hDrop, i, uintptr(unsafe.Pointer(&buf[0])), n+1)
		paths = append(paths, syscall.UTF16ToString(buf))
	}
	pDragFinish.Call(hDrop)
	msgs, _ := processAll(paths)
	for _, m := range msgs {
		appendLog(m)
	}
}

func wndProc(hwnd, msg, wParam, lParam uintptr) uintptr {
	switch msg {
	case wmDropFiles:
		handleDrop(wParam)
		return 0
	case wmDestroy:
		pPostQuitMessage.Call(0)
		return 0
	}
	r, _, _ := pDefWindowProcW.Call(hwnd, msg, wParam, lParam)
	return r
}

// editProc przekazuje upuszczenie plików na polu dziennika do głównej obsługi.
func editProc(hwnd, msg, wParam, lParam uintptr) uintptr {
	if msg == wmDropFiles {
		handleDrop(wParam)
		return 0
	}
	r, _, _ := pCallWindowProcW.Call(oldEditProc, hwnd, msg, wParam, lParam)
	return r
}

func runWindow() {
	hInst, _, _ := pGetModuleHandleW.Call(0)
	cursor, _, _ := pLoadCursorW.Call(0, idcArrow)
	className := utf16Ptr("KreatorFolderowWnd")

	type wndClassEx struct {
		size, style                        uint32
		wndProc                            uintptr
		clsExtra, wndExtra                 int32
		instance, icon, cursor, background uintptr
		menuName, className                *uint16
		iconSm                             uintptr
	}
	wc := wndClassEx{
		wndProc:    syscall.NewCallback(wndProc),
		instance:   hInst,
		cursor:     cursor,
		background: colorBtnFace + 1,
		className:  className,
	}
	wc.size = uint32(unsafe.Sizeof(wc))
	pRegisterClassExW.Call(uintptr(unsafe.Pointer(&wc)))

	scrW, _, _ := pGetSystemMetrics.Call(smCxScreen)
	scrH, _, _ := pGetSystemMetrics.Call(smCyScreen)
	x := (int(scrW) - winW) / 2
	y := (int(scrH) - winH) / 2

	style := uintptr(wsOverlapped | wsCaption | wsSysMenu | wsMinimizeBox | wsVisible)
	hwnd, _, _ := pCreateWindowExW.Call(0,
		uintptr(unsafe.Pointer(className)),
		uintptr(unsafe.Pointer(utf16Ptr("Kreator Folderów — NC/TXT"))),
		style, uintptr(x), uintptr(y), winW, winH, 0, 0, hInst, 0)

	hint := "▼  Przeciągnij tutaj plik .txt lub .nc  ▼\r\n\r\n" +
		"Na Pulpicie powstanie folder o nazwie z nawiasu\r\n" +
		"z pierwszej linijki pliku, a plik zostanie do niego skopiowany.\r\n\r\n" +
		"Możesz też przeciągać pliki wprost na ikonę programu."
	hStatic, _, _ := pCreateWindowExW.Call(0,
		uintptr(unsafe.Pointer(utf16Ptr("STATIC"))),
		uintptr(unsafe.Pointer(utf16Ptr(hint))),
		wsChild|wsVisible|ssCenter, 20, 25, winW-60, 140, hwnd, 0, hInst, 0)

	hLog, _, _ = pCreateWindowExW.Call(0x200, /*WS_EX_CLIENTEDGE*/
		uintptr(unsafe.Pointer(utf16Ptr("EDIT"))),
		uintptr(unsafe.Pointer(utf16Ptr(""))),
		wsChild|wsVisible|wsBorder|wsVScroll|esMultiline|esAutoVScroll|esReadonly,
		20, 180, winW-60, 220, hwnd, 0, hInst, 0)

	font, _, _ := pCreateFontW.Call(^uintptr(17) /* -18 */, 0, 0, 0, 400, 0, 0, 0,
		1 /*DEFAULT_CHARSET*/, 0, 0, 5 /*CLEARTYPE*/, 0,
		uintptr(unsafe.Pointer(utf16Ptr("Segoe UI"))))
	pSendMessageW.Call(hStatic, wmSetFont, font, 1)
	pSendMessageW.Call(hLog, wmSetFont, font, 1)

	// Przyjmuj pliki zarówno na oknie, jak i na polu dziennika.
	pDragAcceptFiles.Call(hwnd, 1)
	pDragAcceptFiles.Call(hLog, 1)
	oldEditProc, _, _ = pSetWindowLongPtrW.Call(hLog, ^uintptr(3), /* GWLP_WNDPROC = -4 */
		syscall.NewCallback(editProc))

	appendLog("Gotowy. Czekam na pliki…")

	pShowWindow.Call(hwnd, swShownormal)
	pUpdateWindow.Call(hwnd)

	var msgBuf [12]uintptr // MSG: hwnd,message,wParam,lParam,time,pt.x,pt.y(+padding)
	for {
		r, _, _ := pGetMessageW.Call(uintptr(unsafe.Pointer(&msgBuf[0])), 0, 0, 0)
		if int32(r) <= 0 {
			break
		}
		pTranslateMessage.Call(uintptr(unsafe.Pointer(&msgBuf[0])))
		pDispatchMessageW.Call(uintptr(unsafe.Pointer(&msgBuf[0])))
	}
}

func main() {
	args := os.Args[1:]
	if len(args) == 0 {
		runWindow()
		return
	}
	msgs, folders := processAll(args)
	icon := uintptr(mbIconInformation)
	for _, m := range msgs {
		if strings.HasPrefix(m, "BŁĄD") {
			icon = mbIconWarning
			break
		}
	}
	pMessageBoxW.Call(0,
		uintptr(unsafe.Pointer(utf16Ptr(strings.Join(msgs, "\n")))),
		uintptr(unsafe.Pointer(utf16Ptr("Kreator Folderów"))),
		mbOK|icon)
	if len(folders) == 1 {
		for f := range folders {
			openInExplorer(f)
		}
	}
}
