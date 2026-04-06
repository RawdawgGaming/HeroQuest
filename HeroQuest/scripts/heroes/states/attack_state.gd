extends HeroState
## 3-hit melee combo. Each hit activates a hitbox briefly.
## Click during the input window to chain to the next combo step.

const COMBO_DAMAGE := [10, 10, 20]  # Damage per combo step (finisher hits harder)
const COMBO_DURATION := [0.35, 0.35, 0.5]  # Duration of each attack animation
const INPUT_WINDOW := 0.15  # Seconds before attack ends where input is accepted

var combo_step: int = 0
var attack_timer: float = 0.0
var input_queued: bool = false
var hitbox_active: bool = false
var hitbox_timer: float = 0.0

const HITBOX_ACTIVE_START := 0.1  # When hitbox activates during attack
const HITBOX_ACTIVE_DURATION := 0.15  # How long hitbox stays active

func enter() -> void:
	combo_step = 0
	_start_attack()

func exit() -> void:
	_deactivate_hitbox()
	combo_step = 0
	input_queued = false

func _start_attack() -> void:
	attack_timer = COMBO_DURATION[combo_step]
	input_queued = false
	hitbox_active = false
	hitbox_timer = 0.0

	# Set hitbox damage for this combo step
	var attack_pivot := hero.get_node_or_null("AttackPivot")
	if attack_pivot:
		var hitbox := attack_pivot.get_node_or_null("HitboxComponent") as HitboxComponent
		if hitbox:
			hitbox.damage = COMBO_DAMAGE[combo_step]

	# Stop hero movement during attack (slight forward nudge)
	var facing := -1.0 if hero.get_node("Sprite2D").flip_h else 1.0
	hero.velocity = Vector2(facing * 30.0, 0)

	# Play attack animation if available
	if hero.has_node("AnimationPlayer"):
		var anim := hero.get_node("AnimationPlayer") as AnimationPlayer
		var anim_name := "attack_%d" % (combo_step + 1)
		if anim.has_animation(anim_name):
			anim.play(anim_name)

func process_physics(delta: float) -> void:
	hero.move_and_slide()

	# Manage hitbox timing
	hitbox_timer += delta
	if not hitbox_active and hitbox_timer >= HITBOX_ACTIVE_START:
		_activate_hitbox()
	if hitbox_active and hitbox_timer >= HITBOX_ACTIVE_START + HITBOX_ACTIVE_DURATION:
		_deactivate_hitbox()

	# Count down attack duration
	attack_timer -= delta

	if attack_timer <= 0:
		# Attack finished -- check if we should chain combo
		if input_queued and combo_step < 2:
			combo_step += 1
			_start_attack()
		else:
			state_machine.transition_to("Idle")

func process_input(event: InputEvent) -> void:
	if event.is_action_pressed("attack"):
		# Only accept combo input during the input window
		if attack_timer <= INPUT_WINDOW and combo_step < 2:
			input_queued = true

func _activate_hitbox() -> void:
	hitbox_active = true
	var attack_pivot := hero.get_node_or_null("AttackPivot")
	if attack_pivot:
		var hitbox := attack_pivot.get_node_or_null("HitboxComponent")
		if hitbox:
			var shape := hitbox.get_node_or_null("CollisionShape2D")
			if shape:
				shape.disabled = false

func _deactivate_hitbox() -> void:
	hitbox_active = false
	var attack_pivot := hero.get_node_or_null("AttackPivot")
	if attack_pivot:
		var hitbox := attack_pivot.get_node_or_null("HitboxComponent")
		if hitbox:
			var shape := hitbox.get_node_or_null("CollisionShape2D")
			if shape:
				shape.disabled = true
