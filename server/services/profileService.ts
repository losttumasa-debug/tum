import { HumanizationProfile, InsertHumanizationProfile, HumanizationSettings } from '@shared/schema';
import { db } from '../db';
import { humanizationProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class ProfileService {
  async createDefaultProfiles(): Promise<void> {
    const existing = await this.getAllProfiles();
    if (existing.length > 0) return;

    const defaultProfiles: InsertHumanizationProfile[] = [
      {
        name: 'Novice User',
        description: 'Simulates a beginner user with slower typing, more errors, and frequent hesitations',
        typingSpeed: 'slow',
        mouseAccuracy: 0.6,
        isDefault: false,
        settings: {
          delayVariation: 50,
          typingErrors: 8,
          hesitationPauses: 35,
          preserveStructure: true,
          removeMouseOnUpload: false,
        } as any,
      },
      {
        name: 'Average User',
        description: 'Typical user behavior with moderate speed and occasional errors',
        typingSpeed: 'medium',
        mouseAccuracy: 0.8,
        isDefault: true,
        settings: {
          delayVariation: 25,
          typingErrors: 3,
          hesitationPauses: 15,
          preserveStructure: true,
          removeMouseOnUpload: false,
        } as any,
      },
      {
        name: 'Expert User',
        description: 'Fast and accurate user with minimal hesitation',
        typingSpeed: 'fast',
        mouseAccuracy: 0.95,
        isDefault: false,
        settings: {
          delayVariation: 10,
          typingErrors: 1,
          hesitationPauses: 5,
          preserveStructure: true,
          removeMouseOnUpload: false,
        } as any,
      },
      {
        name: 'Cautious User',
        description: 'Careful user who double-checks actions with many pauses',
        typingSpeed: 'slow',
        mouseAccuracy: 0.9,
        isDefault: false,
        settings: {
          delayVariation: 40,
          typingErrors: 2,
          hesitationPauses: 45,
          preserveStructure: true,
          removeMouseOnUpload: false,
        } as any,
      },
      {
        name: 'Power User',
        description: 'Very fast user with keyboard shortcuts and minimal mouse use',
        typingSpeed: 'fast',
        mouseAccuracy: 0.85,
        isDefault: false,
        settings: {
          delayVariation: 5,
          typingErrors: 0,
          hesitationPauses: 2,
          preserveStructure: true,
          removeMouseOnUpload: true,
        } as any,
      },
    ];

    for (const profile of defaultProfiles) {
      await db.insert(humanizationProfiles).values(profile);
    }

    console.log(`Created ${defaultProfiles.length} default humanization profiles`);
  }

  async createProfile(profile: InsertHumanizationProfile): Promise<HumanizationProfile> {
    if (profile.isDefault) {
      await db
        .update(humanizationProfiles)
        .set({ isDefault: false })
        .where(eq(humanizationProfiles.isDefault, true));
    }

    const [created] = await db
      .insert(humanizationProfiles)
      .values(profile)
      .returning();

    return created;
  }

  async getProfile(id: string): Promise<HumanizationProfile | null> {
    const profile = await db.query.humanizationProfiles.findFirst({
      where: eq(humanizationProfiles.id, id),
    });
    return profile || null;
  }

  async getProfileByName(name: string): Promise<HumanizationProfile | null> {
    const profile = await db.query.humanizationProfiles.findFirst({
      where: eq(humanizationProfiles.name, name),
    });
    return profile || null;
  }

  async getAllProfiles(): Promise<HumanizationProfile[]> {
    return await db.query.humanizationProfiles.findMany();
  }

  async getDefaultProfile(): Promise<HumanizationProfile | null> {
    const profile = await db.query.humanizationProfiles.findFirst({
      where: eq(humanizationProfiles.isDefault, true),
    });
    return profile || null;
  }

  async updateProfile(id: string, updates: Partial<HumanizationProfile>): Promise<HumanizationProfile | null> {
    if (updates.isDefault) {
      await db
        .update(humanizationProfiles)
        .set({ isDefault: false })
        .where(eq(humanizationProfiles.isDefault, true));
    }

    const [updated] = await db
      .update(humanizationProfiles)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(humanizationProfiles.id, id))
      .returning();

    return updated || null;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const result = await db
      .delete(humanizationProfiles)
      .where(eq(humanizationProfiles.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async applyProfileToSettings(profileId: string): Promise<HumanizationSettings> {
    const profile = await this.getProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return profile.settings as HumanizationSettings;
  }

  adjustSettingsForTypingSpeed(
    settings: HumanizationSettings,
    typingSpeed: 'slow' | 'medium' | 'fast'
  ): HumanizationSettings {
    const speedMultipliers = {
      slow: 1.5,
      medium: 1.0,
      fast: 0.6,
    };

    const multiplier = speedMultipliers[typingSpeed];

    return {
      ...settings,
      delayVariation: Math.round(settings.delayVariation * multiplier),
      hesitationPauses: Math.round(settings.hesitationPauses * multiplier),
    };
  }
}

export const profileService = new ProfileService();
