extends HeroState
## Hero stands still. Transitions to Run on movement input, Attack on attack input.

func enter() -> void:
	# Play idle animation when we have one
	if hero.has_node("AnimationPlayer"):
		var anim := hero.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("idle"):
			anim.play("idle")

func process_physics(_delta: float) -> void:
	# Check for movement input
	var input_dir := Vector2(
		Input.get_axis("move_left", "move_right"),
		Input.get_axis("move_up", "move_down")
	)

	if input_dir != Vector2.ZERO:
		state_machine.transition_to("Run")
		return

	# Stop moving
	hero.velocity = Vector2.ZERO
	hero.move_and_slide()

func process_input(event: InputEvent) -> void:
	if event.is_action_pressed("attack"):
		state_machine.transition_to("Attack")
