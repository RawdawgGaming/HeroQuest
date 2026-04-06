extends CharacterBody2D
## Base enemy controller. Manages component wiring.

@onready var stats: StatsComponent = $StatsComponent
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var state_machine: EnemyStateMachine = $EnemyStateMachine

var is_dead: bool = false

func _ready() -> void:
	add_to_group("enemy")

	# Wire hurtbox -> health
	hurtbox.damage_received.connect(_on_damage_received)
	health.died.connect(_on_died)

func _on_damage_received(amount: int) -> void:
	if is_dead:
		return
	health.take_damage(amount)
	if not is_dead:
		state_machine.transition_to("Hurt")

func _on_died() -> void:
	is_dead = true
	state_machine.transition_to("Death")
