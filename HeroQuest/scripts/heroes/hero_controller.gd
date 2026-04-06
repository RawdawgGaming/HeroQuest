extends CharacterBody2D
## Main hero controller. Manages component wiring and state machine references.
## Movement and combat logic live in the state machine's states.

@onready var stats: StatsComponent = $StatsComponent
@onready var health: HealthComponent = $HealthComponent
@onready var hurtbox: HurtboxComponent = $HurtboxComponent
@onready var sprite: Sprite2D = $Sprite2D
@onready var state_machine: HeroStateMachine = $StateMachine

var is_dead: bool = false

func _ready() -> void:
	# Wire hurtbox damage -> health component
	hurtbox.damage_received.connect(_on_damage_received)

	# Wire death
	health.died.connect(_on_died)

	# Wire health changes to EventBus for HUD
	health.health_changed.connect(_on_health_changed)

	# Emit initial health for HUD
	EventBus.hero_health_changed.emit(health.current_health, stats.max_health)

func _on_damage_received(amount: int) -> void:
	if is_dead:
		return
	health.take_damage(amount)
	if not is_dead:
		state_machine.transition_to("Hurt")

func _on_died() -> void:
	is_dead = true
	state_machine.transition_to("Death")

func _on_health_changed(current: int, maximum: int) -> void:
	EventBus.hero_health_changed.emit(current, maximum)
