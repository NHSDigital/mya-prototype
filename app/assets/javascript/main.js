document.addEventListener('DOMContentLoaded', () => {
  const table = document.getElementById('bookings-table');
  if (!table) return;

  // Header checkbox
  const headerCheckbox = table.querySelector('#select-all');

  // All row checkboxes (everything starting with select- except select-all)
  const rowCheckboxes = Array.from(
    table.querySelectorAll('input[id^="select-"]:not(#select-all)')
  );

  // Click on header toggles all rows
  headerCheckbox.addEventListener('change', () => {
    rowCheckboxes.forEach(cb => {
      cb.checked = headerCheckbox.checked;
    });
    headerCheckbox.indeterminate = false;
  });

  // Click on rows updates header state
  rowCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const allChecked = rowCheckboxes.every(c => c.checked);
      const noneChecked = rowCheckboxes.every(c => !c.checked);

      headerCheckbox.checked = allChecked;
      headerCheckbox.indeterminate = !allChecked && !noneChecked;
    });
  });
});
