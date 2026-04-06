extends Node
class_name HeroStateMachine
## Manages hero state transitions. Add HeroState children as states.

@export var initial_state: HeroState

var current_state: HeroState

func _ready() -> void:
	# Wire up all child states
	for child in get_children():
		if child is HeroState:
			child.hero = owner
			child.state_machine = self

	# Start in initial state
	if initial_state:
		current_state = initial_state
		current_state.enter()

func transition_to(new_state_name: String) -> void:
	var new_state := get_node_or_null(new_state_name) as HeroState
	if new_state == null:
		push_warning("HeroStateMachine: State '%s' not found" % new_state_name)
		return
	if new_state == current_state:
		return

	current_state.exit()
	current_state = new_state
	current_state.enter()

func _unhandled_input(event: InputEvent) -> void:
	if current_state:
		current_state.process_input(event)

func _process(delta: float) -> void:
	if current_state:
		current_state.process_frame(delta)

func _physics_process(delta: float) -> void:
	if current_state:
		current_state.process_physics(delta)
