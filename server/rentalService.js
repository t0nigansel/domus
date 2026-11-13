import db from './db.js';
import { createRentalService } from './rentalOperations.js';
export { localToday } from './rentalOperations.js';

export const { overview, createRental, updateRental, saveApplication, saveViewing, confirmLegacyLease, updateLease, completeRental } = createRentalService(db);
