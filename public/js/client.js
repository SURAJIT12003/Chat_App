const form = document.getElementById('join-form');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = e.target.username.value;
  const room = e.target.room.value;
  window.location.href = `chatroom.html?username=${username}&room=${room}`;
});
