extends Camera2D
## Smooth-follow camera with stage boundaries and look-ahead.

@export var target_path: NodePath
@export var follow_speed: float = 5.0
@export var look_ahead_distance: float = 50.0
@export var vertical_damping: float = 0.3

var target: Node2D
var locked_right_limit: float = INF

func _ready() -> void:
	if target_path:
		target = get_node(target_path)

func _physics_process(delta: float) -> void:
	if target == null:
		return

	var target_pos := target.global_position

	# Add look-ahead in the direction the hero faces
	var sprite := target.get_node_or_null("Sprite2D") as Sprite2D
	if sprite:
		var facing := -1.0 if sprite.flip_h else 1.0
		target_pos.x += facing * look_ahead_distance

	# Smooth follow (horizontal fast, vertical dampened for Castle Crashers feel)
	var new_pos := global_position
	new_pos.x = lerp(new_pos.x, target_pos.x, follow_speed * delta)
	new_pos.y = lerp(new_pos.y, target_pos.y, follow_speed * vertical_damping * delta)

	# Clamp to stage limits
	new_pos.x = clamp(new_pos.x, limit_left + get_viewport_rect().size.x / 2.0, limit_right - get_viewport_rect().size.x / 2.0)
	new_pos.y = clamp(new_pos.y, limit_top + get_viewport_rect().size.y / 2.0, limit_bottom - get_viewport_rect().size.y / 2.0)

	# Apply wave-lock (prevent scrolling past locked point)
	if locked_right_limit < INF:
		var max_x := locked_right_limit - get_viewport_rect().size.x / 2.0
		new_pos.x = min(new_pos.x, max_x)

	global_position = new_pos

func lock_scroll(right_limit: float) -> void:
	locked_right_limit = right_limit

func unlock_scroll() -> void:
	locked_right_limit = INF
