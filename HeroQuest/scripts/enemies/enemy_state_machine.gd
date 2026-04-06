extends Node
class_name EnemyStateMachine
## Manages enemy state transitions. Add EnemyState children as states.

@export var initial_state: EnemyState

var current_state: EnemyState

func _ready() -> void:
	for child in get_children():
		if child is EnemyState:
			child.enemy = owner
			child.state_machine = self

	if initial_state:
		current_state = initial_state
		current_state.enter()

func transition_to(new_state_name: String) -> void:
	var new_state := get_node_or_null(new_state_name) as EnemyState
	if new_state == null:
		push_warning("EnemyStateMachine: State '%s' not found" % new_state_name)
		return
	if new_state == current_state:
		return

	current_state.exit()
	current_state = new_state
	current_state.enter()

func _process(delta: float) -> void:
	if current_state:
		current_state.process_frame(delta)

func _physics_process(delta: float) -> void:
	if current_state:
		current_state.process_physics(delta)
