const { describe, test } = require('node:test');

// The full ride story. Turn each todo into a real test as its endpoint is built.
describe('ride flow', () => {
  test.todo('rider requests a ride (#6): fare and distance come from the server');
  test.todo('rider cannot request a second ride while one is active (#6)');
  test.todo('driver goes online and sends a location (#16, #18)');
  test.todo('driver sees the request nearby, matching vehicle type (#17)');
  test.todo('driver declines; the ride disappears for that driver only (#11)');
  test.todo('driver accepts; PIN is created, rider sees it, driver does not (#10, #7)');
  test.todo('two drivers accept at once; exactly one wins (#10)');
  test.todo('driver marks arrived (#12)');
  test.todo('wrong PIN adds an attempt and is refused (#13)');
  test.todo('PIN locks with 423 after PIN_MAX_ATTEMPTS wrong tries (#13)');
  test.todo('right PIN starts the ride (#13)');
  test.todo('driver completes the ride (#14)');
  test.todo('rider rates once; a second rating is refused (#15)');
  test.todo('driver earnings show the completed ride (#19)');
  test.todo('cancel is allowed before start, refused after (#9)');
  test.todo('someone else\'s ride returns 404 (#7)');
  test.todo('rides list is newest first and filterable by status (#8)');
  test.todo('push token is saved and updated (#20)');
});
