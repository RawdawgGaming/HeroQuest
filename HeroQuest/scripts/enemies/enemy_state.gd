extends Node
class_name EnemyState
## Base class for all enemy states. Override methods in subclasses.

var enemy: CharacterBody2D
var state_machine: Node

func enter() -> void:
	pass

func exit() -> void:
	pass

func process_frame(_delta: float) -> void:
	pass

func process_physics(_delta: float) -> void:
	pass
