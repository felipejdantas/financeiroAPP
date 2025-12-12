
-- Add total_cycles column to fixed_costs table
-- distinct from 'auto_generate', this limits the number of times it is generated.
ALTER TABLE "fixed_costs" ADD COLUMN "total_cycles" INTEGER;
