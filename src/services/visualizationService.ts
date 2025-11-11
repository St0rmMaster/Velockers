import { supabase } from '../lib/supabaseClient';
import type {
  GroupVisibilitySettings,
  MaterialColorSettings,
  EnvironmentDefaultSettings,
} from '../types';
import type { EnvironmentSettings } from '../components/BoatViewer';
import { logger } from '../utils/logger';

/**
 * Load group visibility settings from Supabase
 */
export async function loadGroupVisibilitySettings(): Promise<GroupVisibilitySettings | null> {
  try {
    const { data, error } = await supabase
      .from('visualization_settings')
      .select('*')
      .eq('settings_type', 'groups')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found, return null
        return null;
      }
      throw error;
    }

    return data?.settings_data as GroupVisibilitySettings;
  } catch (error) {
    logger.error('visualizationService', { 
      event: 'loadGroupVisibilitySettings:error', 
      error 
    });
    return null;
  }
}

/**
 * Save group visibility settings to Supabase
 */
export async function saveGroupVisibilitySettings(
  settings: GroupVisibilitySettings,
  adminId: string
): Promise<boolean> {
  try {
    // Deactivate all existing group settings for this admin
    await supabase
      .from('visualization_settings')
      .update({ is_active: false })
      .eq('admin_id', adminId)
      .eq('settings_type', 'groups');

    // Insert new settings
    const { error } = await supabase
      .from('visualization_settings')
      .insert({
        admin_id: adminId,
        settings_type: 'groups',
        settings_data: settings,
        is_active: true,
      });

    if (error) throw error;

    logger.info('visualizationService', { 
      event: 'saveGroupVisibilitySettings:success' 
    });
    return true;
  } catch (error) {
    logger.error('visualizationService', { 
      event: 'saveGroupVisibilitySettings:error', 
      error 
    });
    return false;
  }
}

/**
 * Load material color settings from Supabase
 */
export async function loadMaterialColorSettings(): Promise<MaterialColorSettings | null> {
  try {
    const { data, error } = await supabase
      .from('visualization_settings')
      .select('*')
      .eq('settings_type', 'materials')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found, return null
        return null;
      }
      throw error;
    }

    return data?.settings_data as MaterialColorSettings;
  } catch (error) {
    logger.error('visualizationService', { 
      event: 'loadMaterialColorSettings:error', 
      error 
    });
    return null;
  }
}

/**
 * Save material color settings to Supabase
 */
export async function saveMaterialColorSettings(
  settings: MaterialColorSettings,
  adminId: string
): Promise<boolean> {
  try {
    // Deactivate all existing material settings for this admin
    await supabase
      .from('visualization_settings')
      .update({ is_active: false })
      .eq('admin_id', adminId)
      .eq('settings_type', 'materials');

    // Insert new settings
    const { error } = await supabase
      .from('visualization_settings')
      .insert({
        admin_id: adminId,
        settings_type: 'materials',
        settings_data: settings,
        is_active: true,
      });

    if (error) throw error;

    logger.info('visualizationService', { 
      event: 'saveMaterialColorSettings:success' 
    });
    return true;
  } catch (error) {
    logger.error('visualizationService', { 
      event: 'saveMaterialColorSettings:error', 
      error 
    });
    return false;
  }
}

/**
 * Load default environment settings from Supabase
 */
export async function loadDefaultEnvironment(): Promise<EnvironmentSettings | null> {
  try {
    const { data, error } = await supabase
      .from('visualization_settings')
      .select('*')
      .eq('settings_type', 'environment')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found, return null
        return null;
      }
      throw error;
    }

    const envData = data?.settings_data as EnvironmentDefaultSettings;
    return envData?.environment as EnvironmentSettings;
  } catch (error) {
    logger.error('visualizationService', { 
      event: 'loadDefaultEnvironment:error', 
      error 
    });
    return null;
  }
}

/**
 * Save default environment settings to Supabase
 */
export async function saveDefaultEnvironment(
  environment: EnvironmentSettings,
  adminId: string
): Promise<boolean> {
  try {
    // Deactivate all existing environment settings for this admin
    await supabase
      .from('visualization_settings')
      .update({ is_active: false })
      .eq('admin_id', adminId)
      .eq('settings_type', 'environment');

    // Insert new settings
    const { error } = await supabase
      .from('visualization_settings')
      .insert({
        admin_id: adminId,
        settings_type: 'environment',
        settings_data: { environment },
        is_active: true,
      });

    if (error) throw error;

    logger.info('visualizationService', { 
      event: 'saveDefaultEnvironment:success' 
    });
    return true;
  } catch (error) {
    logger.error('visualizationService', { 
      event: 'saveDefaultEnvironment:error', 
      error 
    });
    return false;
  }
}

