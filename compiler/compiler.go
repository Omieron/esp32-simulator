package compiler

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	sketchName = "sketch"
	fqbn       = "esp32:esp32:esp32s3"
)

// CompileResult holds the outcome of a compile attempt.
type CompileResult struct {
	Success  bool   // true if .bin was produced
	BinPath  string // absolute path to .bin (empty on failure)
	Stdout   string // arduino-cli stdout
	Stderr   string // arduino-cli stderr
	ErrorMsg string // human-readable error (e.g. "arduino-cli not found")
}

// Compile compiles Arduino code for ESP32-S3.
// Uses os.MkdirTemp, writes sketch.ino, runs arduino-cli, returns result.
// The returned BinPath is valid until the caller removes it; caller is responsible for cleanup.
func Compile(code string) (*CompileResult, error) {
	result := &CompileResult{}

	// Resolve arduino-cli path (PATH or auto-download to ~/.esp32-simulator/bin)
	arduinoCli, err := resolveArduinoCliPath()
	if err != nil {
		result.ErrorMsg = err.Error()
		return result, err
	}

	// 1. Create temp directory
	tmpDir, err := os.MkdirTemp("", "esp32-sim-*")
	if err != nil {
		result.ErrorMsg = "failed to create temporary directory: " + err.Error()
		return result, err
	}
	defer os.RemoveAll(tmpDir)

	// 2. Create sketch/sketch.ino structure (Arduino requires folder name = .ino name)
	sketchDir := filepath.Join(tmpDir, sketchName)
	if err := os.MkdirAll(sketchDir, 0755); err != nil {
		result.ErrorMsg = "failed to create sketch directory: " + err.Error()
		return result, err
	}

	inoPath := filepath.Join(sketchDir, sketchName+".ino")
	if err := os.WriteFile(inoPath, []byte(code), 0644); err != nil {
		result.ErrorMsg = "failed to write sketch file: " + err.Error()
		return result, err
	}

	// 3. Build path for arduino-cli output
	buildPath := filepath.Join(tmpDir, "build")

	// 4. Run arduino-cli compile
	cmd := exec.Command(arduinoCli, "compile",
		"-b", fqbn,
		"--build-path", buildPath,
		sketchDir,
	)

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err = cmd.Run()
	result.Stdout = stdout.String()
	result.Stderr = stderr.String()

	if err != nil {
		result.ErrorMsg = "compilation failed"
		if result.Stderr != "" {
			result.ErrorMsg += ": " + strings.TrimSpace(result.Stderr)
		} else {
			result.ErrorMsg += ": " + err.Error()
		}
		return result, err
	}

	// 5. Find .bin file in build directory
	binPath, err := findBinFile(buildPath)
	if err != nil {
		result.ErrorMsg = "compilation succeeded but .bin file not found: " + err.Error()
		return result, err
	}

	// 6. Copy .bin to a persistent temp file (original tmpDir is deleted by defer)
	// Caller gets a valid path they can use; caller is responsible for cleanup.
	persistentBin, err := os.CreateTemp("", "esp32-sim-*.bin")
	if err != nil {
		result.ErrorMsg = "failed to create output .bin file: " + err.Error()
		return result, err
	}
	persistentPath := persistentBin.Name()
	persistentBin.Close()

	binData, err := os.ReadFile(binPath)
	if err != nil {
		os.Remove(persistentPath)
		result.ErrorMsg = "failed to read compiled .bin: " + err.Error()
		return result, err
	}
	if err := os.WriteFile(persistentPath, binData, 0644); err != nil {
		os.Remove(persistentPath)
		result.ErrorMsg = "failed to write .bin: " + err.Error()
		return result, err
	}

	result.Success = true
	result.BinPath = persistentPath
	return result, nil
}

// findBinFile walks the build directory and returns the path to the first .bin file.
func findBinFile(buildDir string) (string, error) {
	var found string
	err := filepath.Walk(buildDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".bin") {
			found = path
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if found == "" {
		return "", os.ErrNotExist
	}
	return found, nil
}
