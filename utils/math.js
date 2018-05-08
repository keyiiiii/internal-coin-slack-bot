// e.g. 10000 -> 10,000 1000000 -> 1,000,000
function toLocaleString(num) {
  const arr = (num + '').split('.');
  arr[0] = arr[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
  return arr.join('.');
}

module.exports = { toLocaleString };