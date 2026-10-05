import type { FastifyInstance } from 'fastify';

import { AppError } from '../../errors/app-error.js';
import { successResponse } from '../../utils/response.js';

import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

import {
  createCourseSchema,
  updateCourseSchema,
  listCoursesSchema,
} from './course.schema.js';

import type { createCourseService } from './course.service.js';

type CourseRoutesOptions = {
  service: ReturnType<typeof createCourseService>;
};

export async function courseRoutes(
  app: FastifyInstance,
  { service }: CourseRoutesOptions,
) {
  // Create course: Faculty and Admin only
  app.post(
    '/courses',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Courses'],
        summary: 'Create a course',
        description: 'Creates a new course. Faculty and admin users only.',
        security: [{ bearerAuth: [] }],

        body: {
          type: 'object',
          required: ['title', 'code', 'credits'],
          properties: {
            title: {
              type: 'string',
              minLength: 3,
            },
            code: {
              type: 'string',
              pattern: '^[A-Z]{2,5}[0-9]{3,4}$',
            },
            credits: {
              type: 'integer',
              minimum: 1,
              maximum: 6,
            },
          },
        },

        response: {
          201: {
            description: 'Course created successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid course data',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Faculty or admin access required',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request, reply) => {
      const result = createCourseSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const course = service.createCourse(result.data);

      return reply
        .status(201)
        .send(successResponse('Course created successfully', course));
    },
  );

  // List courses: Public
  app.get(
    '/courses',
    {
      schema: {
        tags: ['Courses'],
        summary: 'List courses',
        description:
          'Returns a paginated list of courses with optional search and credit filters.',

        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 10,
            },
            search: {
              type: 'string',
            },
            credits: {
              type: 'integer',
              minimum: 1,
              maximum: 6,
            },
          },
        },

        response: {
          200: {
            description: 'Courses retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid query parameters',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request) => {
      const result = listCoursesSchema.safeParse(request.query);

      if (!result.success) {
        throw new AppError(
          result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const courses = service.getCourses(result.data);

      return successResponse('Courses retrieved successfully', courses);
    },
  );

  // Get course by ID: Public
  app.get<{ Params: { id: string } }>(
    '/courses/:id',
    {
      schema: {
        tags: ['Courses'],
        summary: 'Get course by ID',
        description: 'Returns a single course using its ID.',

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },

        response: {
          200: {
            description: 'Course retrieved successfully',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Course not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request) => {
      const course = service.getCourseById(request.params.id);

      return successResponse('Course retrieved successfully', course);
    },
  );

  // Update course: Faculty and Admin only
  app.patch<{ Params: { id: string } }>(
    '/courses/:id',
    {
      preHandler: [authenticate, authorize('faculty', 'admin')],
      schema: {
        tags: ['Courses'],
        summary: 'Update a course',
        description:
          'Updates one or more fields of an existing course. Faculty and admin users only.',
        security: [{ bearerAuth: [] }],

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },

        body: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              minLength: 3,
            },
            code: {
              type: 'string',
              pattern: '^[A-Z]{2,5}[0-9]{3,4}$',
            },
            credits: {
              type: 'integer',
              minimum: 1,
              maximum: 6,
            },
          },
        },

        response: {
          200: {
            description: 'Course updated successfully',
            type: 'object',
            additionalProperties: true,
          },
          400: {
            description: 'Invalid course data',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Faculty or admin access required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Course not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request) => {
      const result = updateCourseSchema.safeParse(request.body);

      if (!result.success) {
        throw new AppError(
          result.error.issues.map((issue) => issue.message).join(', '),
          400,
          'VALIDATION_ERROR',
        );
      }

      const course = service.updateCourse(request.params.id, result.data);

      return successResponse('Course updated successfully', course);
    },
  );

  // Delete course: Admin only
  app.delete<{ Params: { id: string } }>(
    '/courses/:id',
    {
      preHandler: [authenticate, authorize('admin')],
      schema: {
        tags: ['Courses'],
        summary: 'Delete a course',
        description: 'Deletes a course. Admin users only.',
        security: [{ bearerAuth: [] }],

        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
            },
          },
        },

        response: {
          200: {
            description: 'Course deleted successfully',
            type: 'object',
            additionalProperties: true,
          },
          401: {
            description: 'Authentication required',
            type: 'object',
            additionalProperties: true,
          },
          403: {
            description: 'Admin access required',
            type: 'object',
            additionalProperties: true,
          },
          404: {
            description: 'Course not found',
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    async (request) => {
      service.deleteCourse(request.params.id);

      return successResponse('Course deleted successfully', {
        id: request.params.id,
      });
    },
  );
}