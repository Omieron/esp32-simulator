package compiler

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

const (
	arduinoCliVersion = "1.2.2" // Pinned version for reproducible downloads
)

var (
	arduinoCliPath string
	arduinoCliErr  error
	arduinoCliOnce sync.Once
)

// resolveArduinoCliPath returns the path to arduino-cli executable.
// 1. Checks PATH first
// 2. If not found, checks bundled location (~/.esp32-simulator/bin/)
// 3. If not found, downloads and installs to bundled location
func resolveArduinoCliPath() (string, error) {
	arduinoCliOnce.Do(func() {
		arduinoCliPath, arduinoCliErr = doResolveArduinoCliPath()
	})
	return arduinoCliPath, arduinoCliErr
}

func doResolveArduinoCliPath() (string, error) {
	// 1. Check PATH
	if path, err := exec.LookPath("arduino-cli"); err == nil {
		return path, nil
	}

	// 2. Check bundled location
	binDir, err := getArduinoCliBinDir()
	if err != nil {
		return "", fmt.Errorf("cannot determine arduino-cli directory: %w", err)
	}

	exeName := "arduino-cli"
	if runtime.GOOS == "windows" {
		exeName += ".exe"
	}
	bundledPath := filepath.Join(binDir, exeName)

	if info, err := os.Stat(bundledPath); err == nil && !info.IsDir() {
		return bundledPath, nil
	}

	// 3. Download and install
	if err := downloadArduinoCli(binDir); err != nil {
		return "", fmt.Errorf("failed to download arduino-cli: %w", err)
	}

	return bundledPath, nil
}

func getArduinoCliBinDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	var baseDir string
	switch runtime.GOOS {
	case "windows":
		baseDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "esp32-simulator")
		if baseDir == "esp32-simulator" {
			baseDir = filepath.Join(home, "AppData", "Local", "esp32-simulator")
		}
	default:
		baseDir = filepath.Join(home, ".esp32-simulator")
	}

	binDir := filepath.Join(baseDir, "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return "", err
	}
	return binDir, nil
}

// downloadArduinoCli fetches arduino-cli for the current platform and extracts to binDir.
func downloadArduinoCli(binDir string) error {
	platformOS, arch := platformToArduinoFormat()
	ext := ".tar.gz"
	if runtime.GOOS == "windows" {
		ext = ".zip"
	}

	fileName := fmt.Sprintf("arduino-cli_%s_%s_%s%s",
		arduinoCliVersion, platformOS, arch, ext)
	url := "https://downloads.arduino.cc/arduino-cli/" + fileName

	resp, err := http.Get(url)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: HTTP %d (URL: %s)", resp.StatusCode, url)
	}

	tmpFile, err := os.CreateTemp("", "arduino-cli-*"+ext)
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	if _, err := io.Copy(tmpFile, resp.Body); err != nil {
		return fmt.Errorf("write failed: %w", err)
	}

	if _, err := tmpFile.Seek(0, 0); err != nil {
		return err
	}

	if ext == ".zip" {
		info, err := tmpFile.Stat()
		if err != nil {
			return err
		}
		return extractZip(tmpFile, info.Size(), binDir)
	}
	return extractTarGz(tmpFile, binDir)
}

func platformToArduinoFormat() (osName, arch string) {
	switch runtime.GOOS {
	case "darwin":
		osName = "macOS"
	case "linux":
		osName = "Linux"
	case "windows":
		osName = "Windows"
	default:
		osName = runtime.GOOS
	}

	switch runtime.GOARCH {
	case "amd64":
		arch = "64bit"
	case "386":
		arch = "32bit"
	case "arm64":
		arch = "ARM64"
	case "arm":
		arch = "ARMv7"
	default:
		arch = runtime.GOARCH
	}

	// macOS uses different naming
	if runtime.GOOS == "darwin" && runtime.GOARCH == "arm64" {
		arch = "ARM64"
	}
	return osName, arch
}

func extractTarGz(r io.Reader, destDir string) error {
	gz, err := gzip.NewReader(r)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if hdr.Typeflag != tar.TypeReg {
			continue
		}
		base := filepath.Base(hdr.Name)
		if base != "arduino-cli" {
			continue
		}
		outPath := filepath.Join(destDir, base)
		out, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, tr); err != nil {
			out.Close()
			return err
		}
		out.Close()
		return nil
	}
	return fmt.Errorf("arduino-cli binary not found in archive")
}

func extractZip(r io.ReaderAt, size int64, destDir string) error {
	zipReader, err := zip.NewReader(r, size)
	if err != nil {
		return err
	}

	for _, f := range zipReader.File {
		if strings.HasSuffix(strings.ToLower(f.Name), "arduino-cli.exe") ||
			strings.HasSuffix(f.Name, "arduino-cli") {
			rc, err := f.Open()
			if err != nil {
				return err
			}
			base := filepath.Base(f.Name)
			outPath := filepath.Join(destDir, base)
			out, err := os.OpenFile(outPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0755)
			if err != nil {
				rc.Close()
				return err
			}
			_, err = io.Copy(out, rc)
			rc.Close()
			out.Close()
			return err
		}
	}
	return fmt.Errorf("arduino-cli binary not found in archive")
}
