extends HeroState
## Hero is moving. Transitions to Idle when no input, Attack on attack input.

func enter() -> void:
	if hero.has_node("AnimationPlayer"):
		var anim := hero.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("run"):
			anim.play("run")

func process_physics(_delta: float) -> void:
	var input_dir := Vector2(
		Input.get_axis("move_left", "move_right"),
		Input.get_axis("move_up", "move_down")
	)

	if input_dir == Vector2.ZERO:
		state_machine.transition_to("Idle")
		return

	# Normalize to prevent faster diagonal movement
	input_dir = input_dir.normalized()

	# Get move speed from stats component
	var speed: float = hero.get_node("StatsComponent").move_speed
	hero.velocity = input_dir * speed
	hero.move_and_slide()

	# Flip sprite based on direction
	if input_dir.x != 0:
		hero.get_node("Sprite2D").flip_h = input_dir.x < 0
		# Flip attack pivot so hitbox faces the right direction
		if hero.has_node("AttackPivot"):
			hero.get_node("AttackPivot").scale.x = -1 if input_dir.x < 0 else 1

func process_input(event: InputEvent) -> void:
	if event.is_action_pressed("attack"):
		state_machine.transition_to("Attack")
