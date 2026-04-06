extends HeroState
## Brief stagger when the hero takes damage. Returns to Idle after duration.

const HURT_DURATION := 0.3
var timer: float = 0.0

func enter() -> void:
	timer = HURT_DURATION
	hero.velocity = Vector2.ZERO

	# Play hurt animation if available
	if hero.has_node("AnimationPlayer"):
		var anim := hero.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("hurt"):
			anim.play("hurt")

	# Visual flash feedback (modulate red briefly)
	hero.modulate = Color(1, 0.3, 0.3)

func exit() -> void:
	hero.modulate = Color.WHITE

func process_physics(delta: float) -> void:
	hero.move_and_slide()
	timer -= delta
	if timer <= 0:
		state_machine.transition_to("Idle")
