# Security model

During internal WerkZ development Patrick requires unrestricted authorized technical access needed to connect, inspect, prepare and test the development environment. Customer authority is prepared during development and activated at the customer-test/handover phase.

At transition, developer rights are inventoried, justified and reduced/revoked as appropriate. Planned, temporary and historical/ad-hoc rights remain distinguishable.

Secret owners should enter credentials through protected processes where possible. WerkZ needs authorized use, not unnecessary plaintext knowledge. Test and production credentials are separated. Secrets never belong in normal logs, knowledge registers, reflections or Git.
