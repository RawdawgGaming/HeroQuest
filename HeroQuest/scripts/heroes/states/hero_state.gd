extends Node
class_name HeroState
## Base class for all hero states. Override methods in subclasses.

var hero: CharacterBody2D
var state_machine: Node

func enter() -> void:
	pass

func exit() -> void:
	pass

func process_input(_event: InputEvent) -> void:
	pass

func process_frame(_delta: float) -> void:
	pass

func process_physics(_delta: float) -> void:
	pass
