import api from './api';

let pendingRequest = null;
let pendingToken = null;
let pendingKey = null;

// Share simultaneous reads from the layout and page; never retain patient data.
export function fetchNurseNotifications(params = {}) {
  const token = localStorage.getItem('token');
  const key = JSON.stringify(params);
  if (pendingRequest && pendingToken === token && pendingKey === key) return pendingRequest;
  const request = api.get('/notifications', { params });
  pendingRequest = request;
  pendingToken = token;
  pendingKey = key;
  const clear = () => {
    if (pendingRequest === request) {
      pendingRequest = null;
      pendingToken = null;
      pendingKey = null;
    }
  };
  request.then(clear, clear);
  return request;
}
