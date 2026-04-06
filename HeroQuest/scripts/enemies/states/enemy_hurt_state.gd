extends EnemyState
## Brief stagger when enemy takes damage. Returns to Chase.

const HURT_DURATION := 0.25
var timer: float = 0.0

func enter() -> void:
	timer = HURT_DURATION
	enemy.velocity = Vector2.ZERO
	enemy.modulate = Color(1, 0.3, 0.3)

	if enemy.has_node("AnimationPlayer"):
		var anim := enemy.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("hurt"):
			anim.play("hurt")

func exit() -> void:
	enemy.modulate = Color.WHITE

func process_physics(delta: float) -> void:
	enemy.move_and_slide()
	timer -= delta
	if timer <= 0:
		state_machine.transition_to("Chase")
