extends HeroState
## Hero has died. Disables input, plays death animation, emits signal.

func enter() -> void:
	hero.velocity = Vector2.ZERO

	# Play death animation if available
	if hero.has_node("AnimationPlayer"):
		var anim := hero.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("death"):
			anim.play("death")

	# Visual feedback
	hero.modulate = Color(0.5, 0.5, 0.5, 0.7)

	# Disable collision so enemies stop targeting
	hero.set_collision_layer_value(2, false)

	EventBus.hero_died.emit()

func process_physics(_delta: float) -> void:
	# No movement or input in death state
	pass

func process_input(_event: InputEvent) -> void:
	# Ignore all input
	pass
