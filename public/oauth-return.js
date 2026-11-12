(function returnToNativeClient() {
  var link = document.getElementById('oauth-native-return');
  if (!link || !link.href) return;
  window.location.replace(link.href);
}());
