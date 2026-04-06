extends Sprite2D
## Temporary placeholder visual for the hero. Draws a colored rectangle.
## Replace this with actual sprite sheets later.

func _ready() -> void:
	var img := Image.create(24, 40, false, Image.FORMAT_RGBA8)
	img.fill(Color(0.2, 0.4, 0.9))  # Blue hero
	# Draw a face indicator (eyes)
	for x in range(14, 18):
		for y in range(8, 12):
			img.set_pixel(x, y, Color.WHITE)
	texture = ImageTexture.create_from_image(img)
