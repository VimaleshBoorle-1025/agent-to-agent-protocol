"""
AAP SDK — Python
3 lines to make any AI agent AAP-compliant.

    from aap import AAPAgent, Action
    agent = AAPAgent(name='vimalesh.finance')
    await agent.register()
"""

from .agent import AAPAgent
from .session import AAPSession
from .constants import Action, Capability

__all__ = ["AAPAgent", "AAPSession", "Action", "Capability"]
__version__ = "1.0.0"
