"""Entry point for the Momentum desktop tray agent.

Run from inside the agent/ directory, with its venv active:
    python main.py
"""
from tray import TrayApp


def main() -> None:
    TrayApp().run()


if __name__ == "__main__":
    main()
