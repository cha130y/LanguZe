import { Injectable } from '@nestjs/common';
import type { MasteryLevel } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MasteryCountsDto, ProgressDto } from './dto/progress.dto.js';

/**
 * What the learner has to show for their practice (FR-060, FR-061).
 *
 * Everything here is counted from the rows that already exist; nothing is kept as
 * a running total except XP, which has its own table so that deleting a world can
 * never take points away (V4).
 */
@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async of(learnerId: string): Promise<ProgressDto> {
    const [xp, totalWords, byLevel, worlds] = await Promise.all([
      this.prisma.learnerXp.findUnique({ where: { learnerId } }),
      this.prisma.vocabularyWord.count({ where: { learnerId } }),
      this.prisma.wordMastery.groupBy({
        by: ['level'],
        where: { learnerId },
        _count: { level: true },
      }),
      this.prisma.world.findMany({
        where: { learnerId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          occurrences: {
            select: { vocabularyWord: { select: { mastery: true } } },
          },
        },
      }),
    ]);

    const counted = (level: MasteryLevel) =>
      byLevel.find((row) => row.level === level)?._count.level ?? 0;

    const words: MasteryCountsDto = {
      /*
       * A word has a mastery row only once it has been answered, so the new ones
       * are whatever is left over. Counting them any other way would mean writing
       * learning data during photo analysis, which nothing else needs.
       */
      NEW:
        totalWords -
        byLevel.reduce((total, row) => total + row._count.level, 0),
      LEARNING: counted('LEARNING'),
      FAMILIAR: counted('FAMILIAR'),
      MASTERED: counted('MASTERED'),
    };

    return {
      totalXp: xp?.totalXp ?? 0,
      words,
      worlds: worlds.map((world) => ({
        id: world.id,
        name: world.name,
        wordCount: world.occurrences.length,
        masteredCount: world.occurrences.filter(
          (occurrence) =>
            occurrence.vocabularyWord.mastery?.level === 'MASTERED',
        ).length,
      })),
    };
  }
}
