/**
 * PULSE Transaction Edit & Delete Modal Component
 * Allows editing or deleting XP transactions with deterministic auto-recalculation
 */

import { DatabaseService } from '../services/database.js';
import { AuthService } from '../services/auth.js';
import { Toast } from './toast.js';
import { SoundService } from '../services/sounds.js';
import { XP_TYPES, XP_TYPE_LABELS } from '../engine/xpEngine.js';

let modalEl = null;
let currentTransaction = null;

export const TransactionModal = {
  init() {
    modalEl = document.getElementById('modal-transaction-edit');
    if (!modalEl) return;
    this.bindEvents();
  },

  open(transaction) {
    if (!modalEl) this.init();
    if (!modalEl || !transaction) return;

    currentTransaction = transaction;
    const form = modalEl.querySelector('#form-edit-transaction');
    if (form) {
      form.querySelector('[name="txId"]').value = transaction.id;
      form.querySelector('[name="txAmount"]').value = transaction.amount;
      form.querySelector('[name="txNotes"]').value = transaction.metadata?.notes || '';
      
      const typeSelect = form.querySelector('[name="txType"]');
      if (typeSelect) {
        typeSelect.value = transaction.type;
      }
    }

    modalEl.classList.add('open');
  },

  close() {
    if (modalEl) modalEl.classList.remove('open');
    currentTransaction = null;
  },

  bindEvents() {
    if (!modalEl) return;

    modalEl.querySelectorAll('.btn-close, .modal-backdrop-close').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });

    const form = modalEl.querySelector('#form-edit-transaction');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = AuthService.getCurrentUser();
        if (!user || !currentTransaction) return;

        const newAmount = Number(form.querySelector('[name="txAmount"]').value);
        const newNotes = form.querySelector('[name="txNotes"]').value.trim();
        const newType = form.querySelector('[name="txType"]').value;

        if (isNaN(newAmount) || newAmount < 0) {
          Toast.error('Invalid Amount', 'XP amount must be a positive number.');
          return;
        }

        try {
          await DatabaseService.updateTransaction(user.uid, currentTransaction.id, {
            amount: newAmount,
            type: newType,
            metadata: {
              ...currentTransaction.metadata,
              notes: newNotes
            }
          });

          SoundService.playClick();
          Toast.success('Transaction Updated', 'XP and game levels recalculated successfully.');
          this.close();
          window.dispatchEvent(new CustomEvent('pulse_state_updated'));
        } catch (err) {
          Toast.error('Update Failed', err.message);
        }
      });

      const deleteBtn = form.querySelector('#btn-delete-tx');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const user = AuthService.getCurrentUser();
          if (!user || !currentTransaction) return;

          if (confirm('Are you sure you want to delete this XP transaction? Your total XP and levels will be automatically recalculated.')) {
            try {
              await DatabaseService.deleteTransaction(user.uid, currentTransaction.id);
              SoundService.playClick();
              Toast.success('Transaction Deleted', 'Recalculation complete.');
              this.close();
              window.dispatchEvent(new CustomEvent('pulse_state_updated'));
            } catch (err) {
              Toast.error('Delete Failed', err.message);
            }
          }
        });
      }
    }
  }
};
