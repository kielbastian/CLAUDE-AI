param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Pliki
)

# Wyciaga nazwe z pierwszego nawiasu znalezionego w pliku,
# np. "O02316 (TRZPIEN UA 227113)" -> "TRZPIEN UA 227113",
# i tworzy folder o tej nazwie obok pliku.

if (-not $Pliki -or $Pliki.Count -eq 0) {
    Write-Host "Nie podano zadnego pliku."
    exit 1
}

foreach ($plik in $Pliki) {
    if (-not (Test-Path -LiteralPath $plik -PathType Leaf)) {
        Write-Host "POMINIETO   : '$plik' - to nie jest plik."
        continue
    }

    $nazwa = $null
    foreach ($linia in [System.IO.File]::ReadLines($plik)) {
        $m = [regex]::Match($linia, '\(([^)]+)\)')
        if ($m.Success) {
            $kandydat = $m.Groups[1].Value.Trim()
            if ($kandydat) {
                $nazwa = $kandydat
                break
            }
        }
    }

    if (-not $nazwa) {
        Write-Host "BLAD        : '$([System.IO.Path]::GetFileName($plik))' - nie znaleziono nazwy w nawiasie."
        continue
    }

    # Usun znaki niedozwolone w nazwach folderow Windows
    $nazwa = ($nazwa -replace '[\\/:*?"<>|]', '_').TrimEnd('.', ' ')

    $katalogPliku = Split-Path -LiteralPath $plik -Parent
    $folder = Join-Path $katalogPliku $nazwa

    if (Test-Path -LiteralPath $folder) {
        Write-Host "JUZ ISTNIEJE: $folder"
    }
    else {
        New-Item -ItemType Directory -Path $folder | Out-Null
        Write-Host "UTWORZONO   : $folder"
    }
}
