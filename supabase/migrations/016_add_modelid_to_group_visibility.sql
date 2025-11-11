-- Migration: Add modelId to existing group visibility mappings
-- This script updates existing group visibility settings to include modelId field
-- Existing mappings will be assigned to model '2.9' as default

-- Function to migrate existing group visibility settings
create or replace function migrate_group_visibility_add_model_id()
returns void
language plpgsql
as $$
declare
  setting_record record;
  updated_data jsonb;
  mapping jsonb;
  new_mappings jsonb;
begin
  -- Loop through all group visibility settings
  for setting_record in 
    select id, settings_data 
    from public.visualization_settings 
    where settings_type = 'groups'
  loop
    -- Initialize new mappings array
    new_mappings := '[]'::jsonb;
    
    -- Check if settings_data has mappings array
    if setting_record.settings_data ? 'mappings' then
      -- Loop through each mapping
      for mapping in select * from jsonb_array_elements(setting_record.settings_data->'mappings')
      loop
        -- Check if mapping already has modelId
        if not (mapping ? 'modelId') then
          -- Add modelId = '2.9' to the mapping (assign existing settings to 2.9)
          mapping := mapping || jsonb_build_object('modelId', '2.9');
        end if;
        
        -- Add updated mapping to new array
        new_mappings := new_mappings || jsonb_build_array(mapping);
      end loop;
      
      -- Update the settings_data with new mappings
      updated_data := jsonb_build_object('mappings', new_mappings);
      
      -- Update the record
      update public.visualization_settings
      set settings_data = updated_data,
          updated_at = now()
      where id = setting_record.id;
      
      raise notice 'Updated visualization_settings record %', setting_record.id;
    end if;
  end loop;
  
  raise notice 'Migration completed successfully';
end;
$$;

-- Run the migration
select migrate_group_visibility_add_model_id();

-- Drop the migration function (cleanup)
drop function migrate_group_visibility_add_model_id();

-- Add comment to document this change
comment on table public.visualization_settings is 
  'Stores visualization configuration for sandbox. 
   Group visibility mappings now include modelId field to support model-specific settings.
   Migration 016: Added modelId to existing mappings (defaulted to 2.9).';

