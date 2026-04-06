extends EnemyState
## Enemy stands still or patrols. Transitions to Chase when hero enters detection zone.

func enter() -> void:
	enemy.velocity = Vector2.ZERO
	if enemy.has_node("AnimationPlayer"):
		var anim := enemy.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("idle"):
			anim.play("idle")

func process_physics(_delta: float) -> void:
	enemy.move_and_slide()

	# Check if hero is in detection zone
	var detection_zone := enemy.get_node_or_null("DetectionZone") as Area2D
	if detection_zone:
		var bodies := detection_zone.get_overlapping_bodies()
		for body in bodies:
			if body.is_in_group("hero"):
				state_machine.transition_to("Chase")
				return
