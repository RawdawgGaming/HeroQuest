extends Sprite2D
## Temporary placeholder visual for enemies. Draws a colored rectangle.
## Replace this with actual sprite sheets later.

@export var enemy_color: Color = Color(0.7, 0.2, 0.2)  # Red by default

func _ready() -> void:
	var img := Image.create(18, 30, false, Image.FORMAT_RGBA8)
	img.fill(enemy_color)
	# Draw eyes
	for x in range(10, 14):
		for y in range(6, 10):
			img.set_pixel(x, y, Color.WHITE)
	texture = ImageTexture.create_from_image(img)
