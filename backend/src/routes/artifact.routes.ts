import { FastifyInstance, FastifyRequest } from 'fastify';
import { ArtifactService } from '../services/artifact.service.js';

export async function artifactRoutes(fastify: FastifyInstance) {
  // Get all artifacts
  fastify.get('/artifacts', async () => {
    const artifacts = await ArtifactService.getArtifacts();
    return { artifacts };
  });

  // Get specific artifact content
  fastify.get(
    '/artifacts/:path(*)',
    async (request: FastifyRequest<{ Params: { path: string } }>) => {
      const { path } = request.params;

      try {
        const content = await ArtifactService.readArtifact(path);
        return { path, content };
      } catch (error) {
        return { error: 'File not found or cannot be read' };
      }
    }
  );

  // Clear all artifacts
  fastify.delete('/artifacts', async () => {
    try {
      await ArtifactService.clearArtifacts();
      return { success: true, message: 'All artifacts cleared' };
    } catch (error) {
      return { success: false, error: 'Failed to clear artifacts' };
    }
  });
}
