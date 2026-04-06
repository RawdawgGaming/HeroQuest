extends EnemyState
## Enemy moves toward the hero. Transitions to Attack when in attack range.

var target: CharacterBody2D

func enter() -> void:
	if enemy.has_node("AnimationPlayer"):
		var anim := enemy.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("run"):
			anim.play("run")

func process_physics(_delta: float) -> void:
	# Find hero target
	target = _find_hero()
	if target == null:
		state_machine.transition_to("Idle")
		return

	# Check if in attack range
	var attack_range := enemy.get_node_or_null("AttackRange") as Area2D
	if attack_range:
		var bodies := attack_range.get_overlapping_bodies()
		for body in bodies:
			if body.is_in_group("hero"):
				state_machine.transition_to("Attack")
				return

	# Move toward hero
	var direction := (target.global_position - enemy.global_position).normalized()
	var speed: float = enemy.get_node("StatsComponent").move_speed
	enemy.velocity = direction * speed
	enemy.move_and_slide()

	# Flip sprite
	if direction.x != 0:
		enemy.get_node("Sprite2D").flip_h = direction.x < 0
		if enemy.has_node("AttackPivot"):
			enemy.get_node("AttackPivot").scale.x = -1 if direction.x < 0 else 1

func _find_hero() -> CharacterBody2D:
	var heroes := enemy.get_tree().get_nodes_in_group("hero")
	if heroes.size() > 0:
		return heroes[0] as CharacterBody2D
	return null
