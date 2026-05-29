param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System.Windows.Forms;
public class DoubleBufferedPanel : Panel {
  public DoubleBufferedPanel() {
    this.DoubleBuffered = true;
    this.ResizeRedraw = true;
  }
}
"@ -ReferencedAssemblies System.Windows.Forms,System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$ErrorActionPreference = 'Stop'

$KitRoot = Join-Path $RepoRoot 'public\assets\biomes\enchanted-forest-kit-v2'
$AssetRoot = Join-Path $KitRoot 'individual'
$ManifestPath = Join-Path $KitRoot 'composer-assets.manifest.json'
$StoragePath = Join-Path $RepoRoot 'forest-stage-1.layout.json'

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  [System.Windows.Forms.MessageBox]::Show("Missing manifest:`n$ManifestPath", "Hero Quest Composer", 'OK', 'Error') | Out-Null
  exit 1
}

$Manifest = Get-Content -Raw -Path $ManifestPath | ConvertFrom-Json
$Assets = @($Manifest.assets)
$Categories = @($Manifest.categories)

$ImageCache = @{}
$ThumbCache = @{}
$Placements = New-Object System.Collections.ArrayList
$Collision = New-Object System.Collections.ArrayList
$WaterRegions = New-Object System.Collections.ArrayList
[void]$Collision.Add([pscustomobject]@{ x = 0; y = 420; width = 8000; height = 140; label = 'main-walk-band' })
[void]$WaterRegions.Add([pscustomobject]@{ x = 0; y = 452; width = 8000; height = 48; speed = 0.18; alpha = 0.22 })

$State = [ordered]@{
  MapId = 'forest-stage-1'
  SpawnX = 180
  SpawnY = 470
  ExitX = 7580
  ExitY = 370
  ExitW = 260
  ExitH = 170
  Category = 'terrain'
  SelectedAsset = $null
  SelectedPlacement = $null
  Zoom = 1.0
  CameraX = 0.0
  CameraY = 0.0
  MouseWorldX = 0
  MouseWorldY = 0
  IsDragging = $false
  DragDX = 0
  DragDY = 0
  IsPanning = $false
  PanStartX = 0
  PanStartY = 0
  PanCameraX = 0
  PanCameraY = 0
  ShowGrid = $true
  ShowCollision = $true
  ShowWater = $true
}

function Get-AssetById([string]$id) {
  foreach ($asset in $Assets) {
    if ($asset.id -eq $id) { return $asset }
  }
  return $null
}

function Get-Image([object]$asset) {
  if (-not $asset) { return $null }
  if ($ImageCache.ContainsKey($asset.id)) { return $ImageCache[$asset.id] }
  $path = Join-Path $AssetRoot $asset.file
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing asset image: $path" }
  $img = [System.Drawing.Image]::FromFile($path)
  $ImageCache[$asset.id] = $img
  return $img
}

function Get-Thumb([object]$asset) {
  if ($ThumbCache.ContainsKey($asset.id)) { return $ThumbCache[$asset.id] }
  $img = Get-Image $asset
  $bmp = New-Object System.Drawing.Bitmap 96, 72
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.Clear([System.Drawing.Color]::FromArgb(16, 29, 20))
    $scale = [Math]::Min(88 / [double]$asset.width, 64 / [double]$asset.height)
    $w = [int]([double]$asset.width * $scale)
    $h = [int]([double]$asset.height * $scale)
    $x = [int]((96 - $w) / 2)
    $y = [int]((72 - $h) / 2)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, $x, $y, $w, $h)
  } finally {
    $g.Dispose()
  }
  $ThumbCache[$asset.id] = $bmp
  return $bmp
}

function New-Placement([object]$asset, [double]$x, [double]$y) {
  $snap = ($asset.category -eq 'terrain' -or $asset.category -eq 'water')
  if ($snap) {
    $x = [Math]::Round($x / 64) * 64
    $y = [Math]::Round($y / 64) * 64
  }
  return [pscustomobject]@{
    id = "$($asset.id)-$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())-$((Get-Random -Maximum 9999))"
    assetId = $asset.id
    file = $asset.file
    x = [int]$x
    y = [int]$y
    width = [int]$asset.width
    height = [int]$asset.height
    scaleX = 1.0
    scaleY = 1.0
    rotation = 0.0
    flipX = $false
    depth = [int]$asset.depth
    scrollFactor = [double]$asset.scrollFactor
    category = [string]$asset.category
    blendMode = if ($asset.blendMode) { [string]$asset.blendMode } else { 'NORMAL' }
    alpha = if ($asset.alpha) { [double]$asset.alpha } else { 1.0 }
  }
}

function World-ToScreen([double]$x, [double]$y) {
  return [System.Drawing.PointF]::new([float](($x - $State.CameraX) * $State.Zoom), [float](($y - $State.CameraY) * $State.Zoom))
}

function Screen-ToWorld([double]$x, [double]$y) {
  return [System.Drawing.PointF]::new([float]($State.CameraX + $x / $State.Zoom), [float]($State.CameraY + $y / $State.Zoom))
}

function Screen-ToLayerWorld([double]$x, [double]$y, [double]$scrollFactor) {
  return [System.Drawing.PointF]::new([float]($State.CameraX * $scrollFactor + $x / $State.Zoom), [float]($State.CameraY * $scrollFactor + $y / $State.Zoom))
}

function Hit-Test([double]$x, [double]$y) {
  $ordered = @($Placements | Sort-Object depth -Descending)
  foreach ($p in $ordered) {
    $hw = [Math]::Abs([double]$p.width * [double]$p.scaleX) / 2
    $hh = [Math]::Abs([double]$p.height * [double]$p.scaleY) / 2
    if ($x -ge ([double]$p.x - $hw) -and $x -le ([double]$p.x + $hw) -and $y -ge ([double]$p.y - $hh) -and $y -le ([double]$p.y + $hh)) {
      return $p
    }
  }
  return $null
}

function Hit-Test-Screen([double]$screenX, [double]$screenY) {
  $ordered = @($Placements | Sort-Object depth -Descending)
  foreach ($p in $ordered) {
    $scroll = if ($p.scrollFactor -ne $null) { [double]$p.scrollFactor } else { 1.0 }
    $cx = (([double]$p.x - $State.CameraX * $scroll) * $State.Zoom)
    $cy = (([double]$p.y - $State.CameraY * $scroll) * $State.Zoom)
    $hw = [Math]::Abs([double]$p.width * [double]$p.scaleX * $State.Zoom) / 2
    $hh = [Math]::Abs([double]$p.height * [double]$p.scaleY * $State.Zoom) / 2
    if ($screenX -ge ($cx - $hw) -and $screenX -le ($cx + $hw) -and $screenY -ge ($cy - $hh) -and $screenY -le ($cy + $hh)) {
      return $p
    }
  }
  return $null
}

function Apply-LayerPreset([object]$placement, [string]$preset) {
  if (-not $placement) { return }
  switch ($preset) {
    'Far BG' { $placement.depth = -220; $placement.scrollFactor = 0.2 }
    'Mid BG' { $placement.depth = -140; $placement.scrollFactor = 0.55 }
    'Play' { $placement.depth = -10; $placement.scrollFactor = 1.0 }
    'Actor Front' { $placement.depth = 120; $placement.scrollFactor = 1.0 }
    'Foreground' { $placement.depth = 540; $placement.scrollFactor = 0.95 }
  }
}

function Export-Layout {
  return [ordered]@{
    id = $State.MapId
    world = [ordered]@{ width = 8000; height = 720 }
    spawn = [ordered]@{ x = [int]$State.SpawnX; y = [int]$State.SpawnY }
    exit = [ordered]@{ x = [int]$State.ExitX; y = [int]$State.ExitY; width = [int]$State.ExitW; height = [int]$State.ExitH }
    placements = @($Placements)
    collision = @($Collision)
    waterRegions = @($WaterRegions)
  }
}

function Import-Layout([object]$layout) {
  $State.MapId = [string]$layout.id
  $State.SpawnX = [int]$layout.spawn.x
  $State.SpawnY = [int]$layout.spawn.y
  $State.ExitX = [int]$layout.exit.x
  $State.ExitY = [int]$layout.exit.y
  $State.ExitW = [int]$layout.exit.width
  $State.ExitH = [int]$layout.exit.height
  $Placements.Clear()
  foreach ($p in @($layout.placements)) { [void]$Placements.Add($p) }
  $Collision.Clear()
  foreach ($c in @($layout.collision)) { [void]$Collision.Add($c) }
  $WaterRegions.Clear()
  foreach ($w in @($layout.waterRegions)) { [void]$WaterRegions.Add($w) }
  $State.SelectedPlacement = $null
}

$Form = New-Object System.Windows.Forms.Form
$Form.Text = 'Hero Quest Map Composer'
$Form.Width = 1500
$Form.Height = 900
$Form.MinimumSize = [System.Drawing.Size]::new(1100, 700)
$Form.BackColor = [System.Drawing.Color]::FromArgb(7, 18, 13)
$Form.KeyPreview = $true

$Top = New-Object System.Windows.Forms.Panel
$Top.Dock = 'Top'
$Top.Height = 44
$Top.BackColor = [System.Drawing.Color]::FromArgb(8, 33, 20)
$Form.Controls.Add($Top)

$Left = New-Object System.Windows.Forms.Panel
$Left.Dock = 'Left'
$Left.Width = 280
$Left.BackColor = [System.Drawing.Color]::FromArgb(10, 29, 20)
$Form.Controls.Add($Left)

$Right = New-Object System.Windows.Forms.Panel
$Right.Dock = 'Right'
$Right.Width = 300
$Right.BackColor = [System.Drawing.Color]::FromArgb(10, 29, 20)
$Form.Controls.Add($Right)

$Status = New-Object System.Windows.Forms.StatusStrip
$Status.BackColor = [System.Drawing.Color]::FromArgb(7, 18, 13)
$Status.ForeColor = [System.Drawing.Color]::FromArgb(210, 235, 185)
$Form.Controls.Add($Status)
$StatusMouse = New-Object System.Windows.Forms.ToolStripStatusLabel
$StatusSelected = New-Object System.Windows.Forms.ToolStripStatusLabel
$StatusCount = New-Object System.Windows.Forms.ToolStripStatusLabel
$StatusHint = New-Object System.Windows.Forms.ToolStripStatusLabel
$StatusHint.Spring = $true
$StatusHint.TextAlign = 'MiddleRight'
$StatusHint.Text = 'Left click place/select - drag move - right/middle drag pan - Delete removes'
[void]$Status.Items.AddRange(@($StatusMouse, $StatusSelected, $StatusCount, $StatusHint))

$Canvas = New-Object DoubleBufferedPanel
$Canvas.Dock = 'Fill'
$Canvas.BackColor = [System.Drawing.Color]::FromArgb(5, 11, 9)
$Form.Controls.Add($Canvas)

function New-Button([string]$text, [int]$x, [scriptblock]$handler) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Left = $x
  $b.Top = 7
  $b.Width = 88
  $b.Height = 30
  $b.FlatStyle = 'Flat'
  $b.BackColor = [System.Drawing.Color]::FromArgb(21, 72, 40)
  $b.ForeColor = [System.Drawing.Color]::White
  $b.Add_Click($handler)
  $Top.Controls.Add($b)
  return $b
}

New-Button 'New' 8 {
  if ([System.Windows.Forms.MessageBox]::Show('Start a new blank layout?', 'Hero Quest Composer', 'YesNo', 'Question') -eq 'Yes') {
    $Placements.Clear()
    $State.SelectedPlacement = $null
    Update-Properties
    $Canvas.Invalidate()
  }
} | Out-Null
New-Button 'Save' 104 {
  Export-Layout | ConvertTo-Json -Depth 8 | Set-Content -Path $StoragePath -Encoding UTF8
} | Out-Null
New-Button 'Load' 200 {
  if (Test-Path -LiteralPath $StoragePath) {
    Import-Layout (Get-Content -Raw -Path $StoragePath | ConvertFrom-Json)
    Update-Properties
    $Canvas.Invalidate()
  }
} | Out-Null
New-Button 'Export JSON' 296 {
  $dlg = New-Object System.Windows.Forms.SaveFileDialog
  $dlg.Filter = 'JSON Layout (*.json)|*.json'
  $dlg.FileName = "$($State.MapId).json"
  if ($dlg.ShowDialog() -eq 'OK') {
    Export-Layout | ConvertTo-Json -Depth 8 | Set-Content -Path $dlg.FileName -Encoding UTF8
  }
} | Out-Null
New-Button 'Import JSON' 408 {
  $dlg = New-Object System.Windows.Forms.OpenFileDialog
  $dlg.Filter = 'JSON Layout (*.json)|*.json'
  if ($dlg.ShowDialog() -eq 'OK') {
    Import-Layout (Get-Content -Raw -Path $dlg.FileName | ConvertFrom-Json)
    Update-Properties
    $Canvas.Invalidate()
  }
} | Out-Null

$ZoomBox = New-Object System.Windows.Forms.ComboBox
$ZoomBox.Left = 528
$ZoomBox.Top = 9
$ZoomBox.Width = 88
$ZoomBox.DropDownStyle = 'DropDownList'
[void]$ZoomBox.Items.AddRange(@('50%', '75%', '100%', '150%'))
$ZoomBox.SelectedIndex = 2
$ZoomBox.Add_SelectedIndexChanged({
  $State.Zoom = switch ($ZoomBox.SelectedItem) { '50%' { 0.5 } '75%' { 0.75 } '150%' { 1.5 } default { 1.0 } }
  $Canvas.Invalidate()
})
$Top.Controls.Add($ZoomBox)

$LayerPreset = New-Object System.Windows.Forms.ComboBox
$LayerPreset.Left = 628
$LayerPreset.Top = 9
$LayerPreset.Width = 110
$LayerPreset.DropDownStyle = 'DropDownList'
[void]$LayerPreset.Items.AddRange(@('Far BG', 'Mid BG', 'Play', 'Actor Front', 'Foreground'))
$LayerPreset.SelectedItem = 'Play'
$Top.Controls.Add($LayerPreset)

New-Button 'Apply Layer' 748 {
  if ($State.SelectedPlacement) {
    Apply-LayerPreset $State.SelectedPlacement $LayerPreset.SelectedItem
    Update-Properties
    $Canvas.Invalidate()
  }
} | Out-Null

New-Button 'Load Ref' 844 {
  $refPath = Join-Path $RepoRoot 'public\assets\maps\forest-reference-stage-1\forest-reference-stage-1.layout.json'
  if (-not (Test-Path -LiteralPath $refPath)) {
    [System.Windows.Forms.MessageBox]::Show("Missing reference layout:`n$refPath", "Hero Quest Composer", 'OK', 'Error') | Out-Null
    return
  }
  Import-Layout (Get-Content -Raw -Path $refPath | ConvertFrom-Json)
  Update-Properties
  $Canvas.Invalidate()
} | Out-Null

$CategoryPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$CategoryPanel.Dock = 'Top'
$CategoryPanel.Height = 176
$CategoryPanel.Padding = [System.Windows.Forms.Padding]::new(8)
$CategoryPanel.BackColor = $Left.BackColor
$Left.Controls.Add($CategoryPanel)

$AssetList = New-Object System.Windows.Forms.ListView
$AssetList.Dock = 'Fill'
$AssetList.View = 'LargeIcon'
$AssetList.MultiSelect = $false
$AssetList.HideSelection = $false
$AssetList.LabelWrap = $true
$AssetList.BackColor = [System.Drawing.Color]::FromArgb(8, 24, 16)
$AssetList.ForeColor = [System.Drawing.Color]::White
$AssetList.BorderStyle = 'None'
$AssetImages = New-Object System.Windows.Forms.ImageList
$AssetImages.ImageSize = [System.Drawing.Size]::new(96, 72)
$AssetImages.ColorDepth = 'Depth32Bit'
$AssetList.LargeImageList = $AssetImages
$Left.Controls.Add($AssetList)

$PropertyGrid = New-Object System.Windows.Forms.PropertyGrid
$PropertyGrid.Dock = 'Fill'
$PropertyGrid.BackColor = [System.Drawing.Color]::FromArgb(10, 29, 20)
$PropertyGrid.ViewBackColor = [System.Drawing.Color]::FromArgb(6, 16, 10)
$PropertyGrid.ViewForeColor = [System.Drawing.Color]::White
$PropertyGrid.HelpVisible = $false
$PropertyGrid.ToolbarVisible = $false
$Right.Controls.Add($PropertyGrid)

function Select-Category([string]$category) {
  $State.Category = $category
  $AssetList.Items.Clear()
  $AssetImages.Images.Clear()
  $items = @($Assets | Where-Object { $_.category -eq $category })
  foreach ($asset in $items) {
    [void]$AssetImages.Images.Add($asset.id, (Get-Thumb $asset))
    $item = New-Object System.Windows.Forms.ListViewItem
    $item.Text = $asset.label
    $item.ImageKey = $asset.id
    $item.Tag = $asset.id
    [void]$AssetList.Items.Add($item)
  }
  if ($AssetList.Items.Count -gt 0) {
    $AssetList.Items[0].Selected = $true
    $State.SelectedAsset = Get-AssetById $AssetList.Items[0].Tag
  }
}

foreach ($category in $Categories) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $category.label
  $button.Tag = $category.id
  $button.Width = 122
  $button.Height = 30
  $button.FlatStyle = 'Flat'
  $button.BackColor = [System.Drawing.Color]::FromArgb(18, 55, 31)
  $button.ForeColor = [System.Drawing.Color]::White
  $button.Add_Click({ Select-Category $this.Tag })
  [void]$CategoryPanel.Controls.Add($button)
}

$AssetList.Add_SelectedIndexChanged({
  if ($AssetList.SelectedItems.Count -gt 0) {
    $State.SelectedAsset = Get-AssetById $AssetList.SelectedItems[0].Tag
  }
})

function Update-Properties {
  if ($State.SelectedPlacement) {
    $PropertyGrid.SelectedObject = $State.SelectedPlacement
  } else {
    $PropertyGrid.SelectedObject = [pscustomobject]@{
      MapId = $State.MapId
      SpawnX = $State.SpawnX
      SpawnY = $State.SpawnY
      ExitX = $State.ExitX
      ExitY = $State.ExitY
      ExitW = $State.ExitW
      ExitH = $State.ExitH
    }
  }
}

$PropertyGrid.Add_PropertyValueChanged({
  $Canvas.Invalidate()
})

$Canvas.Add_Paint({
  param($sender, $e)
  $g = $e.Graphics
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(5, 11, 9))

  $g.ScaleTransform([float]$State.Zoom, [float]$State.Zoom)
  $g.TranslateTransform([float](-$State.CameraX), [float](-$State.CameraY))

  $backBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(9, 29, 18))
  $g.FillRectangle($backBrush, 0, 0, 8000, 720)
  $backBrush.Dispose()

  if ($State.ShowGrid) {
    $gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(22, 210, 235, 185)), 1
    for ($x = 0; $x -le 8000; $x += 64) { $g.DrawLine($gridPen, $x, 0, $x, 720) }
    for ($y = 0; $y -le 720; $y += 64) { $g.DrawLine($gridPen, 0, $y, 8000, $y) }
    $gridPen.Dispose()
  }

  $walkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(28, 225, 196, 75))
  $g.FillRectangle($walkBrush, 0, 420, 8000, 140)
  $walkBrush.Dispose()

  if ($State.ShowCollision) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 255, 82, 104))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 255, 82, 104)), 1
    foreach ($c in $Collision) {
      $g.FillRectangle($brush, [int]$c.x, [int]$c.y, [int]$c.width, [int]$c.height)
      $g.DrawRectangle($pen, [int]$c.x, [int]$c.y, [int]$c.width, [int]$c.height)
    }
    $brush.Dispose(); $pen.Dispose()
  }

  if ($State.ShowWater) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(34, 62, 210, 230))
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(200, 89, 236, 243)), 1
    foreach ($w in $WaterRegions) {
      $g.FillRectangle($brush, [int]$w.x, [int]$w.y, [int]$w.width, [int]$w.height)
      $g.DrawRectangle($pen, [int]$w.x, [int]$w.y, [int]$w.width, [int]$w.height)
    }
    $brush.Dispose(); $pen.Dispose()
  }

  $g.ResetTransform()
  foreach ($p in @($Placements | Sort-Object depth)) {
    $asset = Get-AssetById $p.assetId
    if (-not $asset) { continue }
    $img = Get-Image $asset
    $gState = $g.Save()
    $scroll = if ($p.scrollFactor -ne $null) { [double]$p.scrollFactor } else { 1.0 }
    $screenX = ([double]$p.x - $State.CameraX * $scroll) * $State.Zoom
    $screenY = ([double]$p.y - $State.CameraY * $scroll) * $State.Zoom
    $g.TranslateTransform([float]$screenX, [float]$screenY)
    $g.ScaleTransform([float]$State.Zoom, [float]$State.Zoom)
    $g.RotateTransform([float](([double]$p.rotation) * 180 / [Math]::PI))
    if ($p.flipX) { $g.ScaleTransform(-1, 1) }
    $w = [int]([double]$p.width * [double]$p.scaleX)
    $h = [int]([double]$p.height * [double]$p.scaleY)
    $g.DrawImage($img, -[int]($w / 2), -[int]($h / 2), $w, $h)
    if ($State.SelectedPlacement -and $p.id -eq $State.SelectedPlacement.id) {
      $selPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 244, 208, 77)), ([float](3 / [Math]::Max(0.5, $State.Zoom)))
      $g.DrawRectangle($selPen, -[int]($w / 2), -[int]($h / 2), $w, $h)
      $selPen.Dispose()
    }
    $g.Restore($gState)
  }
})

$Canvas.Add_MouseDown({
  param($sender, $e)
  $world = Screen-ToWorld $e.X $e.Y
  if ($e.Button -eq 'Right' -or $e.Button -eq 'Middle') {
    $State.IsPanning = $true
    $State.PanStartX = $e.X
    $State.PanStartY = $e.Y
    $State.PanCameraX = $State.CameraX
    $State.PanCameraY = $State.CameraY
    return
  }
  $hit = Hit-Test-Screen $e.X $e.Y
  if ($hit) {
    $State.SelectedPlacement = $hit
    $State.IsDragging = $true
    $layerWorld = Screen-ToLayerWorld $e.X $e.Y ([double]$hit.scrollFactor)
    $State.DragDX = $layerWorld.X - [double]$hit.x
    $State.DragDY = $layerWorld.Y - [double]$hit.y
  } elseif ($State.SelectedAsset) {
    $layerWorld = Screen-ToLayerWorld $e.X $e.Y ([double]$State.SelectedAsset.scrollFactor)
    $placement = New-Placement $State.SelectedAsset $layerWorld.X $layerWorld.Y
    [void]$Placements.Add($placement)
    $State.SelectedPlacement = $placement
  }
  Update-Properties
  $Canvas.Invalidate()
})

$Canvas.Add_MouseMove({
  param($sender, $e)
  $world = Screen-ToWorld $e.X $e.Y
  $State.MouseWorldX = [int]$world.X
  $State.MouseWorldY = [int]$world.Y
  if ($State.IsPanning) {
    $State.CameraX = [Math]::Max(0, $State.PanCameraX - (($e.X - $State.PanStartX) / $State.Zoom))
    $State.CameraY = [Math]::Max(0, $State.PanCameraY - (($e.Y - $State.PanStartY) / $State.Zoom))
    $Canvas.Invalidate()
  } elseif ($State.IsDragging -and $State.SelectedPlacement) {
    $layerWorld = Screen-ToLayerWorld $e.X $e.Y ([double]$State.SelectedPlacement.scrollFactor)
    $State.SelectedPlacement.x = [int]($layerWorld.X - $State.DragDX)
    $State.SelectedPlacement.y = [int]($layerWorld.Y - $State.DragDY)
    $Canvas.Invalidate()
  }
  $StatusMouse.Text = "Mouse: $($State.MouseWorldX), $($State.MouseWorldY)"
  $StatusSelected.Text = "Selected: $(if ($State.SelectedPlacement) { $State.SelectedPlacement.id } else { 'none' })"
  $StatusCount.Text = "Objects: $($Placements.Count)"
})

$Canvas.Add_MouseUp({
  $State.IsDragging = $false
  $State.IsPanning = $false
  Update-Properties
})

$Canvas.Add_MouseWheel({
  param($sender, $e)
  if ($e.Delta -gt 0) { $State.Zoom = [Math]::Min(2.0, $State.Zoom + 0.1) } else { $State.Zoom = [Math]::Max(0.35, $State.Zoom - 0.1) }
  $Canvas.Invalidate()
})

$Form.Add_KeyDown({
  param($sender, $e)
  if (($e.KeyCode -eq 'Delete' -or $e.KeyCode -eq 'Back') -and $State.SelectedPlacement) {
    [void]$Placements.Remove($State.SelectedPlacement)
    $State.SelectedPlacement = $null
    Update-Properties
    $Canvas.Invalidate()
  }
  if ($State.SelectedPlacement) {
    $nudge = if ($e.Shift) { 10 } else { 1 }
    if ($e.KeyCode -eq 'Left') { $State.SelectedPlacement.x -= $nudge }
    if ($e.KeyCode -eq 'Right') { $State.SelectedPlacement.x += $nudge }
    if ($e.KeyCode -eq 'Up') { $State.SelectedPlacement.y -= $nudge }
    if ($e.KeyCode -eq 'Down') { $State.SelectedPlacement.y += $nudge }
    $Canvas.Invalidate()
  }
})

$Form.Add_FormClosed({
  foreach ($img in $ImageCache.Values) { $img.Dispose() }
  foreach ($img in $ThumbCache.Values) { $img.Dispose() }
})

Select-Category 'terrain'
Update-Properties
[void][System.Windows.Forms.Application]::Run($Form)
