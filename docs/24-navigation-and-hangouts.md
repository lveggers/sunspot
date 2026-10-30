# Navigation and ending hangouts

SunSpot now gives each invitation and profile page an explicit way back. Profiles opened from an invitation return to that invitation; this context survives a detour through the privacy page and its language links. The map remains the main entry point in the private application.

`/hangs` gathers invitations opened in the current browser, including hosted hangouts and guest invitations. It refreshes status from the server on entry, every 30 seconds while visible, and when the tab becomes visible. Active/upcoming entries show the user's role. Ended and expired entries are tucked under Previous hangouts. Entries disappear after the existing one-day retention window. The list contains no host or guest credentials; those remain in their existing browser-local keys. Google profile synchronization does not imply cross-device hangout management.

The public recipient application's home page opens this overview instead of a dead-end landing page. Guests can reach their profile, return to an invitation, or revisit recently opened invitations without access to the private map. Existing API restrictions and private deployment protection remain in place.

Hosts see Extend and End hangout directly on the invitation. End opens a native modal with an explanation, cancellation, Escape support and a separate confirmation. The existing server authorization still permits only the host to end it. After ending, guests see the ended state and cannot RSVP. The host can return to the map; guests can return to their hangout overview. The RSVP name form can also be cancelled.

Navigation and labels are available in Swedish, Danish and English. Mobile verification covers 390px and 320px widths, host/guest return navigation, privacy round-trip, saved invitation history, cancelled and confirmed ending, and the guest's ended state.
