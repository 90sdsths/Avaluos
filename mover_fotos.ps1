# =====================================================================
# MOVER FOTOS DE AVALÚO  (OneDrive -> carpeta del proyecto)
# Lee el CSV "avaluos_fotos_YYYY-MM-DD.csv" exportado por la app y mueve
# las fotos desde una carpeta de origen (OneDrive) a la carpeta del
# proyecto. Identifica cada foto por NOMBRE o, si no lo encuentra, por
# HORA + GPS (EXIF), usando ExifTool.
#
# Uso:
#   .\mover_fotos.ps1 -Csv "ruta\avaluos_fotos_2026-06-15.csv" `
#                     -Origen "C:\Users\USUARIO\OneDrive\...\Fotos" `
#                     -Destino "C:\...\Proyecto\04_Registro_Fotografico\00_Importar"
#
# Requisitos: ExifTool en C:\000_Mis_Herramientas\Exiftool\exiftool.exe
# =====================================================================

param(
    [Parameter(Mandatory=$true)][string]$Csv,
    [Parameter(Mandatory=$true)][string]$Origen,
    [Parameter(Mandatory=$true)][string]$Destino,
    [switch]$Copiar,                 # si se indica, COPIA en vez de MOVER
    [int]$ToleranciaSegundos = 3     # margen para emparejar por hora
)

$EXIFTOOL = "C:\000_Mis_Herramientas\Exiftool\exiftool.exe"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " MOVER FOTOS DE AVALUO" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

if (-not (Test-Path $Csv))     { Write-Host "No existe el CSV: $Csv" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $Origen))  { Write-Host "No existe la carpeta origen: $Origen" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $Destino)) { New-Item -ItemType Directory -Path $Destino -Force | Out-Null }

$usarExif = Test-Path $EXIFTOOL
if (-not $usarExif) {
    Write-Host "AVISO: no se encontro ExifTool. Solo se emparejara por NOMBRE." -ForegroundColor Yellow
}

# Leer CSV (separado por ; como lo exporta la app)
$filas = Import-Csv -Path $Csv -Delimiter ';'
Write-Host "Fotos en el CSV: $($filas.Count)"

# Precargar EXIF (hora original) de las fotos del origen, una sola pasada
$indiceHora = @{}
if ($usarExif) {
    Write-Host "Leyendo EXIF de las fotos en origen (puede tardar)..." -ForegroundColor Gray
    $salida = & $EXIFTOOL -q -q -DateTimeOriginal -csv -r $Origen 2>$null
    if ($salida) {
        $tmp = $salida | ConvertFrom-Csv
        foreach ($row in $tmp) {
            if ($row.DateTimeOriginal) {
                # normalizar "2026:06:15 10:31:20" -> objeto DateTime
                try {
                    $dt = [datetime]::ParseExact($row.DateTimeOriginal.Substring(0,19), "yyyy:MM:dd HH:mm:ss", $null)
                    $clave = $dt.ToString("yyyyMMddHHmmss")
                    $indiceHora[$clave] = $row.SourceFile
                } catch {}
            }
        }
    }
}

$movidas = 0; $noEncontradas = 0
foreach ($f in $filas) {
    $nombre = $f.nombre
    $origenArchivo = $null

    # 1) intentar por NOMBRE exacto (recursivo en origen)
    if ($nombre) {
        $hit = Get-ChildItem -Path $Origen -Recurse -Filter $nombre -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($hit) { $origenArchivo = $hit.FullName }
    }

    # 2) si no se hallo por nombre, intentar por HORA (EXIF) con tolerancia
    if (-not $origenArchivo -and $usarExif -and $f.fecha) {
        try {
            $objetivo = [datetime]::Parse(($f.fecha -replace 'T',' '))
            for ($s = -$ToleranciaSegundos; $s -le $ToleranciaSegundos; $s++) {
                $clave = $objetivo.AddSeconds($s).ToString("yyyyMMddHHmmss")
                if ($indiceHora.ContainsKey($clave)) { $origenArchivo = $indiceHora[$clave]; break }
            }
        } catch {}
    }

    if ($origenArchivo -and (Test-Path $origenArchivo)) {
        $destinoArchivo = Join-Path $Destino (Split-Path $origenArchivo -Leaf)
        if ($Copiar) {
            Copy-Item $origenArchivo $destinoArchivo -Force
            Write-Host "  COPIADA: $(Split-Path $origenArchivo -Leaf)" -ForegroundColor Green
        } else {
            Move-Item $origenArchivo $destinoArchivo -Force
            Write-Host "  MOVIDA:  $(Split-Path $origenArchivo -Leaf)" -ForegroundColor Green
        }
        $movidas++
    } else {
        Write-Host "  NO HALLADA: $nombre  (hora: $($f.fecha))" -ForegroundColor Yellow
        $noEncontradas++
    }
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Procesadas: $movidas   |   No halladas: $noEncontradas" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
