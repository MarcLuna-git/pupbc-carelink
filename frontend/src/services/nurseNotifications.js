import api from './api';

let pendingRequest = null;
let pendingToken = null;

// Share simultaneous reads from the layout and page; never retain patient data.
export function fetchNurseNotifications() {
  const token = localStorage.getItem('token');
  if (pendingRequest && pendingToken === token) return pendingRequest;
  const request = api.get('/notifications');
  pendingRequest = request;
  pendingToken = token;
  const clear = () => {
    if (pendingRequest === request) {
      pendingRequest = null;
      pendingToken = null;
    }
  };
  request.then(clear, clear);
  return request;
}
