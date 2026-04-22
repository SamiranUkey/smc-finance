/* ================================================
   EXECUTION ENGINE - MT5 Bridge
   ================================================ */
async function executeTrade(signalId) {
   try {
      const response = await fetch(`/api/signals/execute/${signalId}`, {
         method: 'POST',
         headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}` 
         }
      });
      const data = await response.json();
      
      if (data.success) {
         showToast(`Trade Sent to MT5: ${data.message}`, 'success');
      } else {
         showToast(`Execution Failed: ${data.error}`, 'error');
      }
   } catch (e) {
      showToast('Connection error to MT5 Bridge', 'error');
   }
}
