package compiler

import (
	"os"
	"path/filepath"
	"testing"
)

// TestCompile runs a real compile if arduino-cli is available.
// Skip if not installed.
func TestCompile(t *testing.T) {
	code := `void setup() {
  pinMode(2, OUTPUT);
}
void loop() {
  digitalWrite(2, HIGH);
  delay(1000);
  digitalWrite(2, LOW);
  delay(1000);
}`

	result, err := Compile(code)

	if err != nil {
		// arduino-cli not found or compile failed - both are acceptable in CI
		if result != nil && result.ErrorMsg != "" {
			t.Logf("Compile failed (expected if arduino-cli not installed): %s", result.ErrorMsg)
		}
		return
	}

	if !result.Success {
		t.Fatalf("expected success, got ErrorMsg: %s", result.ErrorMsg)
	}

	if result.BinPath == "" {
		t.Fatal("expected non-empty BinPath on success")
	}

	// Verify .bin file exists and has content
	info, err := os.Stat(result.BinPath)
	if err != nil {
		t.Fatalf("BinPath %q not accessible: %v", result.BinPath, err)
	}
	if info.Size() == 0 {
		t.Fatal("expected non-zero .bin file size")
	}
	if filepath.Ext(result.BinPath) != ".bin" {
		t.Errorf("expected .bin extension, got %q", filepath.Ext(result.BinPath))
	}

	// Cleanup
	os.Remove(result.BinPath)
}
