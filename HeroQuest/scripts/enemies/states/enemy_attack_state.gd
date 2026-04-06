extends EnemyState
## Enemy performs an attack, then waits for cooldown before deciding next action.

const ATTACK_DURATION := 0.4
const ATTACK_COOLDOWN := 0.8
const HITBOX_START := 0.15
const HITBOX_DURATION := 0.15

var timer: float = 0.0
var phase: String = "attack"  # "attack" or "cooldown"
var hitbox_activated: bool = false

func enter() -> void:
	timer = ATTACK_DURATION
	phase = "attack"
	hitbox_activated = false
	enemy.velocity = Vector2.ZERO

	if enemy.has_node("AnimationPlayer"):
		var anim := enemy.get_node("AnimationPlayer") as AnimationPlayer
		if anim.has_animation("attack"):
			anim.play("attack")

func exit() -> void:
	_deactivate_hitbox()

func process_physics(delta: float) -> void:
	enemy.move_and_slide()
	timer -= delta

	if phase == "attack":
		# Manage hitbox timing
		var elapsed := ATTACK_DURATION - timer
		if not hitbox_activated and elapsed >= HITBOX_START:
			_activate_hitbox()
			hitbox_activated = true
		if hitbox_activated and elapsed >= HITBOX_START + HITBOX_DURATION:
			_deactivate_hitbox()

		if timer <= 0:
			phase = "cooldown"
			timer = ATTACK_COOLDOWN
	elif phase == "cooldown":
		if timer <= 0:
			# Check if hero still in attack range
			var attack_range := enemy.get_node_or_null("AttackRange") as Area2D
			if attack_range:
				var bodies := attack_range.get_overlapping_bodies()
				for body in bodies:
					if body.is_in_group("hero"):
						# Attack again
						enter()
						return
			# Hero left range, chase
			state_machine.transition_to("Chase")

func _activate_hitbox() -> void:
	var attack_pivot := enemy.get_node_or_null("AttackPivot")
	if attack_pivot:
		var hitbox := attack_pivot.get_node_or_null("HitboxComponent")
		if hitbox:
			var shape := hitbox.get_node_or_null("CollisionShape2D")
			if shape:
				shape.disabled = false

func _deactivate_hitbox() -> void:
	var attack_pivot := enemy.get_node_or_null("AttackPivot")
	if attack_pivot:
		var hitbox := attack_pivot.get_node_or_null("HitboxComponent")
		if hitbox:
			var shape := hitbox.get_node_or_null("CollisionShape2D")
			if shape:
				shape.disabled = true
